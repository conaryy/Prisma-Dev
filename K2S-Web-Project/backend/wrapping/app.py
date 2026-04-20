from flask import Flask, render_template, request, send_file, session, jsonify
import requests
from bs4 import BeautifulSoup
import io
import uuid
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import os
import hmac
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

app = Flask(__name__)
wrapper_secret_key = (os.getenv('WRAPPER_SECRET_KEY') or '').strip()
if not wrapper_secret_key:
    raise RuntimeError('WRAPPER_SECRET_KEY wajib diisi.')
app.secret_key = wrapper_secret_key

WRAPPER_INTERNAL_TOKEN = (
    os.getenv('WRAPPER_INTERNAL_TOKEN')
    or os.getenv('EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN')
    or ''
).strip()
if not WRAPPER_INTERNAL_TOKEN:
    raise RuntimeError('WRAPPER_INTERNAL_TOKEN wajib diisi.')

WEB2_URL = os.getenv('WEB2_URL', "http://180.214.246.148")
WRAPPER_ALLOW_PUBLIC_UI = os.getenv('WRAPPER_ALLOW_PUBLIC_UI', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)

# Penyimpanan session di memory (server-side)
user_sessions = {}
session_meta = {}


def _is_internal_authorized() -> bool:
    token = (request.headers.get('X-Internal-Token') or '').strip()
    if token == '':
        return False
    return hmac.compare_digest(token, WRAPPER_INTERNAL_TOKEN)


def _reject_internal():
    return jsonify({'error': 'Unauthorized internal access.'}), 403


def _reject_public_ui():
    return jsonify({'error': 'Endpoint disabled in production.'}), 404

# --- Helper Functions for Automation ---

def _ajax_headers(referer):
    return {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": USER_AGENT,
        "Referer": referer,
    }

def _escape_multipart_header(value):
    return str(value or "").replace("\\", "\\\\").replace('"', '\\"')

def _encode_webkit_multipart(fields):
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex[:16]}"
    body_parts = []

    for name, value in fields:
        body_parts.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{_escape_multipart_header(name)}"\r\n\r\n'.encode(),
                str(value or "").encode(),
                b"\r\n",
            ]
        )

    body_parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(body_parts), boundary

def _run_penyusunan_automation(s, main_path_segment, debug_log):
    """
    Handles the automation logic for 'Penyusunan CAP'.
    Accepts a pre-built main_path_segment.
    """
    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    debug_log.append(f"GET: {main_page_url}")

    try:
        res = s.get(main_page_url)
        res.raise_for_status()
    except Exception as e:
        return ({"error": f"Gagal mengakses halaman {main_path_segment}: {str(e)}"}, debug_log)

    soup = BeautifulSoup(res.text, 'html.parser')
    grouped_results = {}
    table_rows = soup.select('table.table-bordered tbody tr')

    if not table_rows:
        return ({"error": "Tidak dapat menemukan tabel data audit."}, debug_log)

    headers = {'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}

    for row in table_rows:
        cols = row.find_all('td')
        if len(cols) < 6: continue
        ketua_tim = cols[2].text.strip()
        tanggal_pelaksanaan = cols[5].text.strip()
        if not ketua_tim and not tanggal_pelaksanaan:
            continue

        group_key = f"{tanggal_pelaksanaan} | {ketua_tim}" if ketua_tim else tanggal_pelaksanaan

        if group_key not in grouped_results:
            grouped_results[group_key] = {
                "ketua_tim": ketua_tim,
                "anggota_dnp": ' '.join(cols[3].stripped_strings),
                "anggota_kobu": ' '.join(cols[4].stripped_strings),
                "tanggal_pelaksanaan": tanggal_pelaksanaan,
                "audits": []
            }

        area_links = cols[1].find_all('a', href=re.compile(r'/fill/'))
        for link in area_links:
            area_name = link.text.strip()
            datatable_url = urljoin(main_page_url, link['href']).replace('/fill/', '/get_datatable/')
            debug_log.append(f"GET: {datatable_url}")
            
            area_data, realisasi_data = None, []
            try:
                response = s.get(datatable_url, headers=headers)
                response.raise_for_status()
                area_data = response.json()
                items_to_process = []
                
                if (isinstance(area_data, list) and area_data and 
                    isinstance(area_data[0], dict) and 'rs_pq' in area_data[0] and
                    isinstance(area_data[0]['rs_pq'], list)):
                    items_to_process = area_data[0]['rs_pq']

                if items_to_process:
                    for item in items_to_process:
                        if (isinstance(item, dict) and item.get('pq_posisi') == 'content' and
                            item.get('data_id') and item.get('pq_id')):
                            data_id, pq_id = item['data_id'], item['pq_id']
                            realisasi_url = f"{WEB2_URL}/{main_path_segment}/get_realisasi?data_id={data_id}&pq_id={pq_id}"
                            debug_log.append(f"GET: {realisasi_url}")
                            try:
                                realisasi_res = s.get(realisasi_url, headers=headers)
                                realisasi_res.raise_for_status()
                                realisasi_json = realisasi_res.json()
                                if 'data_output' in realisasi_json and 'data_pq' in realisasi_json['data_output']:
                                    realisasi_data.append(realisasi_json['data_output']['data_pq'])
                                else:
                                    realisasi_data.append(realisasi_json)
                            except Exception as e_realisasi:
                                realisasi_data.append({"error": f"Gagal mengambil realisasi: {str(e_realisasi)}"})
                else:
                    if isinstance(area_data, dict): area_data["log"] = "Struktur 'rs_pq' tidak ditemukan."
            except Exception as e:
                area_data = f"--- GAGAL: {str(e)} ---"

            grouped_results[group_key]['audits'].append({
                "area": area_name,
                "data_datatable": area_data,
                "data_realisasi": realisasi_data
            })
            
    return (grouped_results, debug_log)

def _run_pemenuhan_automation(s, main_path_segment, debug_log):
    """
    Handles the automation logic for 'Pemenuhan CAP'.
    Accepts a pre-built main_path_segment.
    """
    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    debug_log.append(f"GET: {main_page_url}")

    try:
        res = s.get(main_page_url)
        res.raise_for_status()
    except Exception as e:
        return ({"error": f"Gagal mengakses halaman {main_path_segment}: {str(e)}"}, debug_log)

    soup = BeautifulSoup(res.text, 'html.parser')
    grouped_results = {}
    table_rows = soup.select('table.table-bordered tbody tr')

    if not table_rows:
        return ({"error": "Tidak dapat menemukan tabel data audit."}, debug_log)

    headers = {'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}

    for row in table_rows:
        cols = row.find_all('td')
        if len(cols) < 6: continue
        ketua_tim = cols[2].text.strip()
        tanggal_pelaksanaan = cols[5].text.strip()
        if not ketua_tim and not tanggal_pelaksanaan:
            continue

        group_key = f"{tanggal_pelaksanaan} | {ketua_tim}" if ketua_tim else tanggal_pelaksanaan

        if group_key not in grouped_results:
            grouped_results[group_key] = {
                "ketua_tim": ketua_tim,
                "anggota_dnp": ' '.join(cols[3].stripped_strings),
                "anggota_kobu": ' '.join(cols[4].stripped_strings),
                "tanggal_pelaksanaan": tanggal_pelaksanaan,
                "audits": []
            }

        area_links = cols[1].find_all('a', href=re.compile(r'/pemenuhan_cap/detail/'))
        for link in area_links:
            area_name = link.text.strip()
            datatable_url = urljoin(main_page_url, link['href']).replace('/detail/', '/get_datatable/')
            debug_log.append(f"GET: {datatable_url}")
            
            datatable_data, cap_details = None, []
            try:
                response = s.get(datatable_url, headers=headers)
                response.raise_for_status()
                datatable_data = response.json()
                items_to_process = []
                
                if (isinstance(datatable_data, list) and datatable_data and 
                    isinstance(datatable_data[0], dict) and 'rs_pq' in datatable_data[0] and
                    isinstance(datatable_data[0]['rs_pq'], list)):
                    items_to_process = datatable_data[0]['rs_pq']

                if items_to_process:
                    for item in items_to_process:
                        if (isinstance(item, dict) and item.get('pq_posisi') == 'content' and
                            item.get('cap_id') and item.get('review_id')):
                            cap_id, review_id = item['cap_id'], item['review_id']
                            
                            # Endpoint 1: get_realisasi_cap
                            realisasi_cap_url = f"{WEB2_URL}/{main_path_segment}/get_realisasi_cap/{cap_id}/{review_id}"
                            debug_log.append(f"GET: {realisasi_cap_url}")
                            realisasi_cap_content = None
                            try:
                                realisasi_res = s.get(realisasi_cap_url, headers=headers)
                                realisasi_res.raise_for_status()
                                realisasi_cap_content = realisasi_res.json()
                            except Exception as e:
                                realisasi_cap_content = {"error": f"Gagal mengambil realisasi_cap: {str(e)}"}

                            # Endpoint 2: get_list_cap
                            list_cap_url = f"{WEB2_URL}/{main_path_segment}/get_list_cap/{cap_id}"
                            debug_log.append(f"GET: {list_cap_url}")
                            list_cap_content = None
                            try:
                                list_cap_res = s.get(list_cap_url, headers=headers)
                                list_cap_res.raise_for_status()
                                list_cap_content = list_cap_res.json()
                            except Exception as e:
                                list_cap_content = {"error": f"Gagal mengambil list_cap: {str(e)}"}

                            cap_details.append({
                                "source_item": item,
                                "realisasi_cap_content": realisasi_cap_content,
                                "list_cap_content": list_cap_content
                            })
                else:
                    if isinstance(datatable_data, dict): datatable_data["log"] = "Struktur 'rs_pq' tidak ditemukan."
            except Exception as e:
                datatable_data = f"--- GAGAL: {str(e)} ---"

            grouped_results[group_key]['audits'].append({
                "area": area_name,
                "datatable_content": datatable_data,
                "cap_details": cap_details
            })
            
    return (grouped_results, debug_log)


def _extract_fill_targets_from_html(soup):
    targets = []
    seen = set()
    fill_pattern = re.compile(r'(?:^|/)fill/([^/]+)/([^/?#"\'\s]+)')

    for tag in soup.find_all('a'):
        href_value = str(tag.get('href') or '').strip()
        onclick_value = str(tag.get('onclick') or '').strip()
        candidates = [value for value in [href_value, onclick_value] if value]

        for candidate in candidates:
            matched = fill_pattern.search(candidate)
            if not matched:
                continue

            code1, code2 = matched.group(1), matched.group(2)
            pair_key = (code1, code2)
            if pair_key in seen:
                continue
            seen.add(pair_key)

            targets.append({
                'code1': code1,
                'code2': code2,
                'area': tag.get_text(' ', strip=True),
                'href': href_value,
            })

    return targets


def _clone_session(base_session):
    cloned = requests.Session()
    cloned.cookies.update(base_session.cookies)
    return cloned


def _fetch_plan_pq_detail(base_session, url, ajax_headers, pair_key):
    worker_session = _clone_session(base_session)
    try:
        response = worker_session.get(
            url,
            headers=ajax_headers,
            params={'plan_id': pair_key[0], 'pq_id': pair_key[1]},
            timeout=45,
        )
        response.raise_for_status()
        return pair_key, response.json()
    except Exception as exc:
        return pair_key, {'error': f'Gagal mengambil get_plan_pq: {str(exc)}'}


def _extract_prefix_letter(pq_no, pq_desc):
    pq_no_text = ' '.join(str(pq_no or '').split())
    pq_desc_text = ' '.join(str(pq_desc or '').split())

    matched_no = re.match(r'^([A-Za-z]+)', pq_no_text)
    if matched_no:
        return matched_no.group(1).upper()

    matched_desc = re.match(r'^([A-Za-z]+)(?:\.\d+)?\s*-', pq_desc_text)
    if matched_desc:
        return matched_desc.group(1).upper()

    return ''


def _extract_pertanyaan_text(pq_desc):
    text = ' '.join(str(pq_desc or '').split())
    if not text:
        return ''

    matched = re.match(r'^[A-Za-z]+(?:\.\d+)?\s*-\s*(.+)$', text)
    if matched:
        return matched.group(1).strip()

    return text


def _build_selfassessment_konten_ref(ref_data):
    refs = []
    for item in ref_data or []:
        if not isinstance(item, dict):
            continue
        ref_no = ' '.join(str(item.get('ref_konten_no') or '').split())
        ref_text = ' '.join(str(item.get('ref_konten') or '').split())
        if ref_no and ref_text:
            refs.append(f"{ref_no} - {ref_text}")
        elif ref_no:
            refs.append(ref_no)
        elif ref_text:
            refs.append(ref_text)
    return '\n'.join(dict.fromkeys(refs))


def _is_selfassessment_question_row(datatable_item, detail_payload):
    pq_no = str(datatable_item.get('pq_no') or '').strip()
    if '.' in pq_no:
        return True
    data_pq = (detail_payload.get('data_output') or {}).get('data_pq') or {}
    return '.' in str(data_pq.get('pq_no') or '').strip()


def _build_selfassessment_compare_item(scope, area_group_id, area, datatable_item, detail_payload):
    data_output = detail_payload.get('data_output') or {}
    data_pq = data_output.get('data_pq') or {}
    ref_data = data_output.get('ref_data') or []
    data_files = data_output.get('data_files') or []

    pq_desc = data_output.get('pq_desc') or datatable_item.get('pq_desc') or ''
    ass_status = data_pq.get('ass_status') or 'SA'

    return {
        'scope': scope,
        'area': area or '',
        'area_group_id': str(area_group_id or '').strip(),
        'plan_id': str(data_pq.get('plan_id') or datatable_item.get('plan_id') or '').strip(),
        'pq_id': str(data_pq.get('pq_id') or datatable_item.get('pq_id') or '').strip(),
        'data_id': str(data_pq.get('data_id') or '').strip(),
        'pq_no': data_pq.get('pq_no') or datatable_item.get('pq_no'),
        'pq_desc': pq_desc,
        'pertanyaan': _extract_pertanyaan_text(pq_desc),
        'pq_guide': data_output.get('pq_guide') or '',
        'konten_ref': _build_selfassessment_konten_ref(ref_data),
        'ref_data': ref_data if isinstance(ref_data, list) else [],
        'data_files': data_files if isinstance(data_files, list) else [],
        'editable': {
            'comment': data_pq.get('comment') or '',
            'ass_status': ass_status if ass_status in {'SA', 'NA', 'NS'} else 'SA',
            'evidence': data_pq.get('evidence') or '',
        },
        'draft_payload': {
            'plan_id': str(data_pq.get('plan_id') or datatable_item.get('plan_id') or '').strip(),
            'area_group_id': str(area_group_id or '').strip(),
            'pq_id': str(data_pq.get('pq_id') or datatable_item.get('pq_id') or '').strip(),
            'is_file_exist': '1' if isinstance(data_files, list) and len(data_files) > 0 else '0',
            'pq_desc': pq_desc,
            'konten_ref': _build_selfassessment_konten_ref(ref_data),
            'ass_status': ass_status if ass_status in {'SA', 'NA', 'NS'} else 'SA',
            'comment': data_pq.get('comment') or '',
            'evidence': data_pq.get('evidence') or '',
            'status': 'draft',
        },
        'raw_detail': detail_payload,
    }


def _fetch_selfassessment_live_files(s, scope, plan_id, pq_id, area_group_id):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {'error': f'Scope selfassessment tidak valid: {scope}'}

    plan_id = str(plan_id or '').strip()
    pq_id = str(pq_id or '').strip()
    area_group_id = str(area_group_id or '').strip()
    if not plan_id or not pq_id:
        return {'error': 'plan_id dan pq_id wajib diisi.'}

    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}" if area_group_id else f"{WEB2_URL}/{main_path_segment}"
    pair_key, detail_payload = _fetch_plan_pq_detail(
        s,
        f"{WEB2_URL}/{main_path_segment}/get_plan_pq",
        _ajax_headers(fill_url),
        (plan_id, pq_id),
    )
    if detail_payload.get('error'):
        return detail_payload

    data_output = detail_payload.get('data_output') or {}
    data_files = data_output.get('data_files') or []
    return {
        'plan_id': pair_key[0],
        'pq_id': pair_key[1],
        'files': data_files if isinstance(data_files, list) else [],
        'raw_detail': detail_payload,
    }


def _resolve_selfassessment_data_id(s, scope, plan_id, pq_id, area_group_id):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return None, {"error": f"Scope selfassessment tidak valid: {scope}"}

    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}"
    url = f"{WEB2_URL}/{main_path_segment}/insert_realisasi/{pq_id}/{plan_id}"
    try:
        res = s.get(url, headers=_ajax_headers(fill_url), timeout=120)
        res.raise_for_status()
    except Exception as exc:
        return None, {"error": f"Gagal mengambil data_id self assessment: {exc}"}

    try:
        payload = res.json()
    except ValueError:
        return None, {"error": f"Respons data_id bukan JSON: {res.text[:500]}"}

    data_id = str(payload.get("data_id") or "").strip()
    if not data_id:
        return None, {"error": "Respons insert_realisasi tidak berisi data_id.", "response": payload}
    return data_id, {"target_url": url, "response": payload}


def _build_deskripsi(ref_konten_no, ref_konten):
    parts = [part.strip() for part in str(ref_konten_no or '').split('-') if part.strip()]
    left_part = ' - '.join(parts)
    right_part = ' '.join(str(ref_konten or '').split())

    if left_part and right_part:
        return f"{left_part} - {right_part}"
    if left_part:
        return left_part
    return right_part


def _collect_deskripsi_fragments(node):
    fragments = []

    def walk(current):
        if isinstance(current, dict):
            if current.get('ref_konten_no') is not None or current.get('ref_konten') is not None:
                built = _build_deskripsi(current.get('ref_konten_no'), current.get('ref_konten'))
                if built:
                    fragments.append(built)
            for value in current.values():
                walk(value)
        elif isinstance(current, list):
            for item in current:
                walk(item)

    walk(node)

    unique_fragments = []
    seen = set()
    for fragment in fragments:
        if fragment in seen:
            continue
        seen.add(fragment)
        unique_fragments.append(fragment)
    return unique_fragments


def _build_selfassessment_main_path(scope):
    if scope == 'audit':
        return 'penyelenggara/audit/pq/selfassessment'
    if scope in ['inspeksi', 'surveillance']:
        return f'penyelenggara/{scope}/pq/selfassessment'
    return None


def _fetch_selfassessment_fill_targets(s, scope, year, debug_log):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {'error': f'Scope selfassessment tidak valid: {scope}'}

    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    search_url = f"{main_page_url}/search_process"
    debug_log.append(f"POST: {search_url}")

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': WEB2_URL,
        'Referer': main_page_url,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    }
    payload = {
        'ci_csrf_token': '',
        'bulan': '',
        'plan_tahun': str(year),
        'save': 'Cari',
    }

    try:
        res = s.post(search_url, data=payload, headers=headers, allow_redirects=True, timeout=120)
        res.raise_for_status()
        debug_log.append(f"Selfassessment URL: {res.url} (status {res.status_code})")
    except Exception as e:
        return {'error': f'Gagal memfilter selfassessment tahun {year}: {str(e)}'}

    soup = BeautifulSoup(res.text, 'html.parser')
    targets = _extract_fill_targets_from_html(soup)
    debug_log.append(f"Selfassessment fill links ditemukan: {len(targets)}")

    for target in targets:
        code1 = target['code1']
        code2 = target['code2']
        target['datatable_url'] = f"{WEB2_URL}/{main_path_segment}/get_datatable/{code1}/{code2}"
        target['fill_url'] = urljoin(main_page_url, target.get('href') or f"fill/{code1}/{code2}")

    return {
        'scope': scope,
        'year': str(year),
        'main_path_segment': main_path_segment,
        'fill_targets': targets,
    }


def _scrape_selfassessment_fill(s, scope, year, code1, code2, area, debug_log):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {'error': f'Scope selfassessment tidak valid: {scope}'}

    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    datatable_url = f"{WEB2_URL}/{main_path_segment}/get_datatable/{code1}/{code2}"
    debug_log.append(f"GET: {datatable_url}")

    ajax_headers = {
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': main_page_url,
    }

    try:
        datatable_res = s.get(datatable_url, headers=ajax_headers, timeout=120)
        datatable_res.raise_for_status()
        datatable_content = datatable_res.json()
    except Exception as e:
        return {'error': f'Gagal mengambil datatable selfassessment: {str(e)}'}

    pq_items = []
    default_plan_id = None
    header_by_pq_id = {}
    if (
        isinstance(datatable_content, list)
        and datatable_content
        and isinstance(datatable_content[0], dict)
        and isinstance(datatable_content[0].get('rs_pq'), list)
    ):
        default_plan_id = datatable_content[0].get('plan_id')
        pq_items = datatable_content[0]['rs_pq']

    for pq_item in pq_items:
        if not isinstance(pq_item, dict):
            continue
        pq_id_value = str(pq_item.get('pq_id') or '').strip()
        pq_induk_value = str(pq_item.get('pq_induk') or '').strip()
        pq_desc_value = str(pq_item.get('pq_desc') or '').strip()
        pq_no_value = str(pq_item.get('pq_no') or '').strip()

        is_header_candidate = (
            pq_id_value
            and pq_desc_value
            and pq_id_value == pq_induk_value
            and bool(re.match(r'^[A-Za-z]+$', pq_no_value))
        )
        if not is_header_candidate:
            continue
        header_by_pq_id[pq_id_value] = {
            'pq_desc': pq_desc_value,
            'pq_no': pq_no_value,
        }

    plan_pq_results = []
    plan_pq_requests = []
    seen_pairs = set()
    for item in pq_items:
        if not isinstance(item, dict):
            continue

        pair_plan_id = item.get('plan_id') or default_plan_id
        pair_pq_id = item.get('pq_id')
        if not pair_plan_id or not pair_pq_id:
            continue

        pair_key = (str(pair_plan_id), str(pair_pq_id))
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)

        pq_induk = str(item.get('pq_induk') or '').strip()
        kategori_header = header_by_pq_id.get(pq_induk) if pq_induk else None
        get_plan_pq_url = f"{WEB2_URL}/{main_path_segment}/get_plan_pq"
        debug_log.append(f"GET: {get_plan_pq_url}?plan_id={pair_key[0]}&pq_id={pair_key[1]}")
        plan_pq_requests.append({
            'plan_id': pair_key[0],
            'pq_id': pair_key[1],
            'pq_desc': item.get('pq_desc'),
            'datatable_pq_desc': item.get('pq_desc'),
            'datatable_pq_no': item.get('pq_no'),
            'datatable_kategori_desc': (kategori_header or {}).get('pq_desc') or item.get('pq_desc'),
            'datatable_kategori_no': (kategori_header or {}).get('pq_no') or item.get('pq_no'),
            'url': f"{get_plan_pq_url}?plan_id={pair_key[0]}&pq_id={pair_key[1]}",
            'pair_key': pair_key,
        })

    if plan_pq_requests:
        max_workers = min(8, len(plan_pq_requests))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(
                    _fetch_plan_pq_detail,
                    s,
                    f"{WEB2_URL}/{main_path_segment}/get_plan_pq",
                    ajax_headers,
                    request_item['pair_key'],
                ): request_item
                for request_item in plan_pq_requests
            }

            detail_by_pair = {}
            for future in as_completed(future_map):
                pair_key, content = future.result()
                detail_by_pair[pair_key] = content

        for request_item in plan_pq_requests:
            request_item.pop('pair_key', None)
            request_item['content'] = detail_by_pair.get(
                (request_item['plan_id'], request_item['pq_id']),
                {'error': 'Detail get_plan_pq tidak ditemukan.'},
            )
            plan_pq_results.append(request_item)

    rows = []
    seen_rows = set()
    for detail in plan_pq_results:
        kategori_value = (
            detail.get('datatable_kategori_desc')
            or detail.get('datatable_pq_desc')
            or detail.get('pq_desc')
            or ''
        )
        pertanyaan_value = detail.get('pq_desc') or kategori_value
        question_no = str(detail.get('datatable_pq_no') or '').strip()
        prefix_value = _extract_prefix_letter(question_no, pertanyaan_value)
        if not prefix_value:
            prefix_value = _extract_prefix_letter(
                detail.get('datatable_kategori_no'),
                detail.get('datatable_kategori_desc') or kategori_value,
            )
        deskripsi_parts = _collect_deskripsi_fragments(detail.get('content'))
        deskripsi_value = ' | '.join(deskripsi_parts)

        kategori = ' '.join(str(kategori_value or '').split())
        prefix = ' '.join(str(prefix_value or '').split())
        pertanyaan = _extract_pertanyaan_text(pertanyaan_value)
        if not kategori or not prefix or not pertanyaan:
            continue

        if pertanyaan.strip().lower() == kategori.strip().lower():
            continue

        row_tuple = (kategori, prefix, pertanyaan, deskripsi_value)
        if row_tuple in seen_rows:
            continue
        seen_rows.add(row_tuple)

        rows.append({
            'kategori': kategori,
            'prefix': prefix,
            'pqNo': ' '.join(
                str(
                    (
                        ((detail.get('content') or {}).get('data_output') or {}).get('data_pq') or {}
                    ).get('pq_no')
                    or detail.get('datatable_pq_no')
                    or ''
                ).split()
            ),
            'pertanyaan': pertanyaan,
            'deskripsi': deskripsi_value,
        })

    return {
        'scope': scope,
        'year': str(year),
        'assessment': {
            'area': area or '',
            'fill_url': urljoin(main_page_url, f'fill/{code1}/{code2}'),
            'datatable_url': datatable_url,
            'datatable_content': datatable_content,
            'plan_pq_details': plan_pq_results,
        },
        'rows': rows,
    }


def _compare_selfassessment_fill(s, scope, year, code1, code2, area, debug_log):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {'error': f'Scope selfassessment tidak valid: {scope}'}

    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    fill_url = f"{main_page_url}/fill/{code1}/{code2}"
    datatable_url = f"{WEB2_URL}/{main_path_segment}/get_datatable/{code1}/{code2}"
    debug_log.append(f"GET: {datatable_url}")

    try:
        datatable_res = s.get(datatable_url, headers=_ajax_headers(fill_url), timeout=120)
        datatable_res.raise_for_status()
        datatable_content = datatable_res.json()
    except Exception as exc:
        return {'error': f'Gagal mengambil datatable self assessment: {exc}'}

    pq_items = []
    if (
        isinstance(datatable_content, list)
        and datatable_content
        and isinstance(datatable_content[0], dict)
        and isinstance(datatable_content[0].get('rs_pq'), list)
    ):
        pq_items = datatable_content[0]['rs_pq']

    requests_to_make = []
    seen = set()
    for item in pq_items:
        if not isinstance(item, dict):
            continue
        item_plan_id = str(item.get('plan_id') or code1 or '').strip()
        item_pq_id = str(item.get('pq_id') or '').strip()
        if not item_plan_id or not item_pq_id or (item_plan_id, item_pq_id) in seen:
            continue
        seen.add((item_plan_id, item_pq_id))
        requests_to_make.append((item, item_plan_id, item_pq_id))

    detail_by_pq_id = {}
    if requests_to_make:
        max_workers = min(8, len(requests_to_make))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(
                    _fetch_plan_pq_detail,
                    s,
                    f"{WEB2_URL}/{main_path_segment}/get_plan_pq",
                    _ajax_headers(fill_url),
                    (item_plan_id, item_pq_id),
                ): item_pq_id
                for _, item_plan_id, item_pq_id in requests_to_make
            }
            for future in as_completed(future_map):
                pair_key, detail_payload = future.result()
                detail_by_pq_id[pair_key[1]] = detail_payload

    items = []
    for item, _, item_pq_id in requests_to_make:
        detail_payload = detail_by_pq_id.get(item_pq_id, {})
        if detail_payload.get('error') or not _is_selfassessment_question_row(item, detail_payload):
            continue
        compare_item = _build_selfassessment_compare_item(
            scope=scope,
            area_group_id=code2,
            area=area,
            datatable_item=item,
            detail_payload=detail_payload,
        )
        if not compare_item.get('data_id'):
            resolved_data_id, data_id_lookup = _resolve_selfassessment_data_id(
                s=s,
                scope=scope,
                plan_id=compare_item.get('plan_id'),
                pq_id=compare_item.get('pq_id'),
                area_group_id=code2,
            )
            if resolved_data_id:
                compare_item['data_id'] = resolved_data_id
                compare_item['data_id_lookup'] = data_id_lookup
                debug_log.append(
                    f"GET: {WEB2_URL}/{main_path_segment}/insert_realisasi/"
                    f"{compare_item.get('pq_id')}/{compare_item.get('plan_id')}"
                )
        items.append(compare_item)
        debug_log.append(
            f"GET: {WEB2_URL}/{main_path_segment}/get_plan_pq?plan_id={items[-1]['plan_id']}&pq_id={items[-1]['pq_id']}"
        )

    return {
        'scope': scope,
        'year': str(year),
        'assessment': {
            'area': area or '',
            'fill_url': fill_url,
            'datatable_url': datatable_url,
        },
        'items': items,
    }

def _post_selfassessment_draft(s, scope, csrf_token, payload_data):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return ({"error": f"Scope selfassessment tidak valid: {scope}"}, 400)

    ass_status = str(payload_data.get('ass_status') or '').strip().upper()
    if ass_status not in {'SA', 'NA', 'NS'}:
        return ({"error": "ass_status harus salah satu dari SA, NA, NS."}, 422)

    required_fields = ['plan_id', 'area_group_id', 'pq_id', 'pq_desc']
    missing_fields = [
        field for field in required_fields if not str(payload_data.get(field) or '').strip()
    ]
    if missing_fields:
        return ({"error": f"Field wajib kosong: {', '.join(missing_fields)}"}, 422)

    plan_id = str(payload_data.get('plan_id') or '').strip()
    area_group_id = str(payload_data.get('area_group_id') or '').strip()
    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}"
    url = f"{WEB2_URL}/{main_path_segment}/fill_process"
    body = {
        'ci_csrf_token': csrf_token or '',
        'plan_id': plan_id,
        'area_group_id': area_group_id,
        'pq_id': str(payload_data.get('pq_id') or '').strip(),
        'is_file_exist': str(payload_data.get('is_file_exist') or '0').strip(),
        'pq_desc': payload_data.get('pq_desc') or '',
        'konten_ref': payload_data.get('konten_ref') or '',
        'ass_status': ass_status,
        'comment': payload_data.get('comment') or '',
        'evidence': payload_data.get('evidence') or '',
        'status': 'draft',
    }

    headers = _ajax_headers(fill_url)
    headers['Origin'] = WEB2_URL
    headers['Accept-Encoding'] = 'gzip, deflate, br'
    headers['Connection'] = 'keep-alive'
    try:
        multipart_body, boundary = _encode_webkit_multipart(list(body.items()))
        headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
        res = s.post(url, data=multipart_body, headers=headers, timeout=120)
        res.raise_for_status()
    except Exception as exc:
        return ({"error": f"Gagal simpan draft self assessment: {exc}"}, 502)

    try:
        response_payload = res.json()
    except ValueError:
        response_payload = {'raw': res.text[:2000]}

    return ({
        'status': 'ok',
        'target_url': url,
        'request_payload': {key: value for key, value in body.items() if key != 'ci_csrf_token'},
        'response': response_payload,
    }, 200)

def _upload_selfassessment_file(s, scope, payload_data, upload_file=None):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return ({"error": f"Scope selfassessment tidak valid: {scope}"}, 400)

    plan_id = str(payload_data.get('plan_id') or '').strip()
    area_group_id = str(payload_data.get('area_group_id') or '').strip()
    pq_id = str(payload_data.get('pq_id') or '').strip()
    data_id = str(payload_data.get('data_id') or '').strip()
    missing_fields = [
        name
        for name, value in {
            'plan_id': plan_id,
            'area_group_id': area_group_id,
            'pq_id': pq_id,
        }.items()
        if not value
    ]
    if missing_fields:
        return ({"error": f"Field wajib kosong: {', '.join(missing_fields)}"}, 422)

    data_id_lookup = None
    if not data_id:
        data_id, data_id_lookup = _resolve_selfassessment_data_id(
            s=s,
            scope=scope,
            plan_id=plan_id,
            pq_id=pq_id,
            area_group_id=area_group_id,
        )
        if not data_id:
            return (data_id_lookup, 502)

    url = f"{WEB2_URL}/{main_path_segment}/upload_one_file"
    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}"
    headers = _ajax_headers(fill_url)
    headers['Origin'] = WEB2_URL
    headers['Accept'] = '*/*'
    data = {'data_id': data_id, 'plan_id': plan_id, 'pq_id': pq_id}

    if upload_file is None:
        return ({"error": "file wajib diisi."}, 422)

    files = [
        (
            'file_evidence',
            (
                upload_file.filename,
                upload_file.stream,
                upload_file.mimetype or 'application/octet-stream',
            ),
        )
    ]

    try:
        res = s.post(url, data=data, files=files, headers=headers, timeout=180)
        res.raise_for_status()
    except Exception as exc:
        return ({"error": f"Gagal upload file self assessment: {exc}"}, 502)

    try:
        response_payload = res.json()
    except ValueError:
        response_payload = {'raw': res.text[:2000]}

    post_upload_inspection = {
        'data_files_count': None,
        'latest_file': None,
        'download_probe': None,
    }
    try:
        post_upload_inspection = inspect_selfassessment_file_after_upload(
            s=s,
            scope=scope,
            plan_id=plan_id,
            pq_id=pq_id,
            area_group_id=area_group_id,
        )
    except Exception:
        pass

    return ({
        'status': 'ok',
        'target_url': url,
        'data_id_lookup': data_id_lookup,
        'sent_filename': upload_file.filename,
        'request_payload': data,
        'response': response_payload,
        'post_upload_inspection': post_upload_inspection,
    }, 200)

def _post_pemenuhan_draft(s, scope, csrf_token, payload_data, upload_file=None):
    if scope == 'audit':
        process_path = 'penyelenggara/audit/cap/pemenuhan_cap/detail_process'
    elif scope in ['inspeksi', 'surveillance']:
        process_path = f'penyelenggara/{scope}/pemenuhan_cap/detail_process'
    else:
        return ({"error": f"Scope tidak valid: {scope}"}, 400)

    plan_id = (payload_data.get('plan_id') or '').strip()
    area_group_id = (payload_data.get('area_group_id') or '').strip()
    cap_id = (payload_data.get('cap_id') or '').strip()
    data_id = (payload_data.get('data_id') or '').strip()
    step_index = str(payload_data.get('step_index') or '').strip()
    if not plan_id or not area_group_id or not cap_id or not data_id or not step_index:
        return ({"error": "plan_id, area_group_id, cap_id, data_id, dan step_index wajib diisi."}, 400)

    referer = f"{WEB2_URL}/{process_path.replace('detail_process', f'detail/{plan_id}/{area_group_id}')}"
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": WEB2_URL,
        "Referer": referer,
    }

    body = {
        "ci_csrf_token": csrf_token or "",
        "plan_id": plan_id,
        "area_group_id": area_group_id,
        "cap_id": cap_id,
        "step_id": str(payload_data.get('step_id') or '').strip(),
        "data_id": data_id,
        "data_st": "draft",
        "btn_action": "draft",
        "step_index": step_index,
        "step_propose": payload_data.get('step_propose') or "",
        "step_location": payload_data.get('step_location') or "",
        "step_progress": str(payload_data.get('step_progress') or "0"),
        "step_evidence_ref": payload_data.get('step_evidence_ref') or "",
        "step_complete_date": payload_data.get('step_complete_date') or "",
        "save": "draft",
    }

    files = None
    if upload_file is not None:
        files = {
            "file[]": (
                upload_file.filename,
                upload_file.stream,
                upload_file.mimetype or "application/octet-stream",
            )
        }

    url = f"{WEB2_URL}/{process_path}"
    try:
        response = s.post(url, headers=headers, data=body, files=files, timeout=180)
        response.raise_for_status()
    except Exception as e:
        return ({"error": f"Gagal submit draft ke DNP: {str(e)}"}, 502)

    try:
        response_json = response.json()
    except ValueError:
        response_json = {"raw": response.text[:2000]}

    return ({
        "status": "ok",
        "target_url": url,
        "request_payload": {k: v for k, v in body.items() if k != "ci_csrf_token"},
        "response": response_json,
    }, 200)


# --- Main Flask Routes ---

@app.route('/')
def index():
    if not WRAPPER_ALLOW_PUBLIC_UI:
        return _reject_public_ui()

    s = requests.Session()
    try:
        response = s.get(f"{WEB2_URL}/")
        soup = BeautifulSoup(response.text, 'html.parser')
        csrf_input = soup.find('input', {'name': 'ci_csrf_token'})
        csrf_token = csrf_input.get('value', '') if csrf_input else ''
        captcha_img = soup.find('img', {'style': lambda x: 'width: 164px' in x if x else False})
        captcha_url = captcha_img['src'] if captcha_img else ''
        user_id = str(uuid.uuid4())
        session['user_id'] = user_id
        user_sessions[user_id] = s
        session_meta[user_id] = {
            'csrf': csrf_token,
            'captcha_url': captcha_url,
        }
        return render_template('index.html', csrf=csrf_token, captcha_url=captcha_url)
    except Exception as e:
        return f"Gagal terhubung ke Web 2: {str(e)}"

@app.route('/proxy-captcha')
def proxy_captcha():
    if not WRAPPER_ALLOW_PUBLIC_UI:
        return _reject_public_ui()

    user_id = session.get('user_id')
    captcha_url = request.args.get('url')
    if user_id in user_sessions and captcha_url:
        s = user_sessions[user_id]
        img_res = s.get(captcha_url)
        return send_file(io.BytesIO(img_res.content), mimetype='image/jpeg')
    return "Unauthorized", 403

@app.route('/login', methods=['POST'])
def login():
    if not WRAPPER_ALLOW_PUBLIC_UI:
        return _reject_public_ui()

    user_id = session.get('user_id')
    if user_id not in user_sessions:
        return "Session Expired. Silakan refresh halaman.", 403
    s = user_sessions[user_id]
    payload = {
        'ci_csrf_token': request.form.get('ci_csrf_token'),
        'username': request.form.get('username'),
        'password': request.form.get('password'),
        'captcha': request.form.get('captcha')
    }
    try:
        res = s.post(f"{WEB2_URL}/login/login_process", data=payload, allow_redirects=True)
        if "login" not in res.url.lower():
            return render_template('success.html', final_url=res.url)
        else:
            return "Login Gagal: Periksa kembali Username/Password/Captcha."
    except Exception as e:
        return f"Terjadi kesalahan saat login: {str(e)}"

@app.route('/fetch-custom')
def fetch_custom():
    return jsonify({'error': 'Endpoint disabled.'}), 410

@app.route('/automation-init', methods=['POST'])
def automation_init():
    if not _is_internal_authorized():
        return _reject_internal()

    s = requests.Session()
    try:
        response = s.get(f"{WEB2_URL}/")
        soup = BeautifulSoup(response.text, 'html.parser')
        csrf_input = soup.find('input', {'name': 'ci_csrf_token'})
        csrf_token = csrf_input.get('value', '') if csrf_input else ''
        captcha_img = soup.find('img', {'style': lambda x: 'width: 164px' in x if x else False})
        captcha_url = captcha_img['src'] if captcha_img else ''
        session_id = str(uuid.uuid4())
        user_sessions[session_id] = s
        session_meta[session_id] = {
            'csrf': csrf_token,
            'captcha_url': captcha_url,
        }
        return jsonify({'session_id': session_id})
    except Exception as e:
        return jsonify({'error': f"Gagal menginisiasi sesi: {str(e)}"}), 500

@app.route('/automation-captcha')
def automation_captcha():
    if not _is_internal_authorized():
        return _reject_internal()

    session_id = request.args.get('session_id')
    if not session_id or session_id not in user_sessions:
        return "Session tidak valid", 403
    meta = session_meta.get(session_id, {})
    captcha_url = meta.get('captcha_url')
    if not captcha_url:
        return "Captcha tidak ditemukan", 404
    s = user_sessions[session_id]
    try:
        img_res = s.get(captcha_url)
        return send_file(io.BytesIO(img_res.content), mimetype='image/jpeg')
    except Exception as e:
        return f"Gagal memuat captcha: {str(e)}", 500

@app.route('/automation-download-file')
def automation_download_file():
    if not _is_internal_authorized():
        return _reject_internal()

    session_id = (request.args.get('session_id') or '').strip()
    scope = (request.args.get('scope') or '').strip().lower()
    file_id = (request.args.get('file_id') or '').strip()

    if not session_id or session_id not in user_sessions:
        return jsonify({'error': 'Session tidak valid'}), 403
    if scope not in ['audit', 'inspeksi', 'surveillance']:
        return jsonify({'error': 'Scope tidak valid'}), 422
    if not file_id:
        return jsonify({'error': 'file_id wajib diisi'}), 422

    s = user_sessions[session_id]
    meta = session_meta.get(session_id, {})
    if not meta.get('authenticated'):
        return jsonify({
            'error': 'Session belum login. Jalankan login instansi terlebih dahulu.',
            'need_new_session': True,
        }), 401

    if scope == 'audit':
        path = f"penyelenggara/audit/cap/pemenuhan_cap/download_file/{file_id}"
    else:
        path = f"penyelenggara/{scope}/pemenuhan_cap/download_file/{file_id}"
    url = f"{WEB2_URL}/{path}"

    try:
        res = s.get(url, allow_redirects=True, timeout=120)
    except Exception as e:
        return jsonify({'error': f'Gagal mengunduh file DNP: {str(e)}'}), 502

    content_type = (res.headers.get('Content-Type') or '').lower()
    if res.status_code >= 400:
        return jsonify({'error': f'DNP merespons {res.status_code} saat unduh file.'}), 502
    if 'text/html' in content_type and 'login' in (res.url or '').lower():
        return jsonify({
            'error': 'Session DNP kedaluwarsa. Login instansi diperlukan.',
            'need_new_session': True,
        }), 401

    disposition = res.headers.get('Content-Disposition')
    output = send_file(
        io.BytesIO(res.content),
        mimetype=res.headers.get('Content-Type') or 'application/octet-stream',
        as_attachment=True,
        download_name=f"dnp-file-{file_id}",
    )
    if disposition:
        output.headers['Content-Disposition'] = disposition
    return output


@app.route('/automation-selfassessment-download-file')
def automation_selfassessment_download_file():
    if not _is_internal_authorized():
        return _reject_internal()

    session_id = (request.args.get('session_id') or '').strip()
    scope = (request.args.get('scope') or '').strip().lower()
    file_id = (request.args.get('file_id') or '').strip()

    if not session_id or session_id not in user_sessions:
        return jsonify({'error': 'Session tidak valid'}), 403
    if scope not in ['audit', 'inspeksi', 'surveillance']:
        return jsonify({'error': 'Scope tidak valid'}), 422
    if not file_id:
        return jsonify({'error': 'file_id wajib diisi'}), 422

    s = user_sessions[session_id]
    meta = session_meta.get(session_id, {})
    if not meta.get('authenticated'):
        return jsonify({
            'error': 'Session belum login. Jalankan login DNP terlebih dahulu.',
            'need_new_session': True,
        }), 401

    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return jsonify({'error': f'Scope tidak valid: {scope}'}), 422

    url = f"{WEB2_URL}/{main_path_segment}/download_file/{file_id}"

    try:
        res = s.get(
            url,
            headers={'User-Agent': USER_AGENT, 'Accept': '*/*'},
            allow_redirects=False,
            timeout=120,
        )
    except Exception as exc:
        return jsonify({'error': f'Gagal download file self assessment: {exc}'}), 502

    content_type = (res.headers.get('Content-Type') or '').lower()
    if res.status_code >= 400:
        return jsonify({'error': f'DNP merespons {res.status_code} saat download file.'}), 502
    if 'text/html' in content_type and 'login' in (res.url or '').lower():
        return jsonify({
            'error': 'Session DNP kedaluwarsa. Login ulang diperlukan.',
            'need_new_session': True,
        }), 401
    if 300 <= res.status_code < 400 and not res.content:
        return jsonify({
            'error': f'DNP merespons redirect {res.status_code} tanpa body file.',
            'location': res.headers.get('Location'),
        }), 502

    disposition = res.headers.get('Content-Disposition')
    output = send_file(
        io.BytesIO(res.content),
        mimetype=res.headers.get('Content-Type') or 'application/octet-stream',
        as_attachment=True,
        download_name=f"dnp-selfassessment-file-{file_id}",
    )
    if disposition:
        output.headers['Content-Disposition'] = disposition
    return output

@app.route('/automation-run', methods=['POST'])
def automation_run():
    if not _is_internal_authorized():
        return _reject_internal()

    incoming = request.form if request.form else (request.json or {})
    session_id = incoming.get('session_id')
    action = (incoming.get('action') or 'sync').strip()

    if not session_id or session_id not in user_sessions:
        return jsonify({'error': 'Session tidak valid'}), 403

    s = user_sessions[session_id]
    meta = session_meta.get(session_id, {})

    if action == 'post_draft':
        if not meta.get('authenticated'):
            return jsonify({
                'error': 'Session belum login. Jalankan update data terlebih dahulu.',
                'need_new_session': True,
            }), 401
        upload_file = request.files.get('file') if request.files else None
        result, status = _post_pemenuhan_draft(
            s=s,
            scope=(incoming.get('type') or '').strip(),
            csrf_token=meta.get('csrf', ''),
            payload_data=incoming,
            upload_file=upload_file,
        )
        return jsonify(result), status

    if action == 'selfassessment_save_draft':
        if not meta.get('authenticated'):
            return jsonify({
                'error': 'Session belum login. Jalankan login DNP terlebih dahulu.',
                'need_new_session': True,
            }), 401
        result, status = _post_selfassessment_draft(
            s=s,
            scope=(incoming.get('type') or '').strip(),
            csrf_token=meta.get('csrf', ''),
            payload_data=incoming,
        )
        return jsonify(result), status

    if action == 'selfassessment_upload_file':
        if not meta.get('authenticated'):
            return jsonify({
                'error': 'Session belum login. Jalankan login DNP terlebih dahulu.',
                'need_new_session': True,
            }), 401
        upload_file = request.files.get('file') if request.files else None
        result, status = _upload_selfassessment_file(
            s=s,
            scope=(incoming.get('type') or '').strip(),
            payload_data=incoming,
            upload_file=upload_file,
        )
        return jsonify(result), status

    captcha_value = (incoming.get('captcha') or '').strip()
    audit_type = (incoming.get('type') or '').strip()
    audit_stage = (incoming.get('stage') or '').strip()
    username = (incoming.get('username') or '').strip()
    password = (incoming.get('password') or '').strip()
    if action != 'login_only' and (not audit_type or not audit_stage):
        return jsonify({'error': 'Tipe dan Tahapan audit harus dipilih.'}), 400

    if not meta.get('authenticated'):
        if not captcha_value:
            return jsonify({'error': 'Captcha wajib diisi'}), 400
        if not username or not password:
            return jsonify({'error': 'Username dan password wajib diisi'}), 400
        payload = {
            'ci_csrf_token': meta.get('csrf', ''),
            'username': username,
            'password': password,
            'captcha': captcha_value,
        }
        try:
            res = s.post(f"{WEB2_URL}/login/login_process", data=payload, allow_redirects=True)
            if "login" in res.url.lower():
                user_sessions.pop(session_id, None)
                session_meta.pop(session_id, None)
                return jsonify({'error': 'Captcha salah atau login gagal.', 'need_new_session': True}), 401
            meta['authenticated'] = True
            session_meta[session_id] = meta
        except Exception as e:
            return jsonify({'error': f"Terjadi kesalahan saat login: {str(e)}"}), 500

    if action == 'login_only':
        return jsonify({
            'status': 'ok',
            'authenticated': True,
        })

    if audit_stage == 'selfassessment':
        year_value = (incoming.get('year') or '').strip()
        if not year_value:
            return jsonify({'error': 'Tahun wajib diisi untuk selfassessment.'}), 400

        try:
            year_number = int(year_value)
        except ValueError:
            return jsonify({'error': 'Format tahun tidak valid.'}), 422

        debug_log = []
        if action == 'selfassessment_fill':
            fill_payload = _fetch_selfassessment_fill_targets(
                s=s,
                scope=audit_type,
                year=year_number,
                debug_log=debug_log,
            )
            if fill_payload.get('error'):
                return jsonify({'error': fill_payload['error'], 'debug_log': debug_log}), 502
            return jsonify({'results': {'selfassessment': fill_payload}, 'debug_log': debug_log})

        if action == 'selfassessment_scrape':
            fill_code1 = (incoming.get('fill_code1') or '').strip()
            fill_code2 = (incoming.get('fill_code2') or '').strip()
            fill_area = (incoming.get('fill_area') or '').strip()
            if not fill_code1 or not fill_code2:
                return jsonify({'error': 'fill_code1 dan fill_code2 wajib diisi.'}), 422

            scrape_payload = _scrape_selfassessment_fill(
                s=s,
                scope=audit_type,
                year=year_number,
                code1=fill_code1,
                code2=fill_code2,
                area=fill_area,
                debug_log=debug_log,
            )
            if scrape_payload.get('error'):
                return jsonify({'error': scrape_payload['error'], 'debug_log': debug_log}), 502

            return jsonify({
                'results': {'selfassessment': scrape_payload},
                'debug_log': debug_log,
            })

        if action == 'selfassessment_compare':
            fill_code1 = (incoming.get('fill_code1') or '').strip()
            fill_code2 = (incoming.get('fill_code2') or '').strip()
            fill_area = (incoming.get('fill_area') or '').strip()
            if not fill_code1 or not fill_code2:
                return jsonify({'error': 'fill_code1 dan fill_code2 wajib diisi.'}), 422

            compare_payload = _compare_selfassessment_fill(
                s=s,
                scope=audit_type,
                year=year_number,
                code1=fill_code1,
                code2=fill_code2,
                area=fill_area,
                debug_log=debug_log,
            )
            if compare_payload.get('error'):
                return jsonify({'error': compare_payload['error'], 'debug_log': debug_log}), 502

            return jsonify({
                'results': {'selfassessment': compare_payload},
                'debug_log': debug_log,
            })

        if action == 'selfassessment_fetch_files':
            files_payload = _fetch_selfassessment_live_files(
                s=s,
                scope=audit_type,
                plan_id=(incoming.get('plan_id') or '').strip(),
                pq_id=(incoming.get('pq_id') or '').strip(),
                area_group_id=(incoming.get('area_group_id') or '').strip(),
            )
            if files_payload.get('error'):
                return jsonify({'error': files_payload['error']}), 502

            return jsonify({
                'results': {'selfassessment': files_payload},
            })

        return jsonify({'error': f'Aksi tidak didukung untuk selfassessment: {action}'}), 422

    debug_log = []
    main_path_segment = ""
    if audit_type == 'audit':
        main_path_segment = f"penyelenggara/audit/cap/{audit_stage}_cap"
    elif audit_type in ['inspeksi', 'surveillance']:
        if audit_stage == 'penyusunan':
            main_path_segment = f"penyelenggara/{audit_type}/cap"
        elif audit_stage == 'pemenuhan':
            main_path_segment = f"penyelenggara/{audit_type}/pemenuhan_cap"

    if not main_path_segment:
        return jsonify({"error": f"Kombinasi Tipe ({audit_type}) dan Tahapan ({audit_stage}) tidak valid."}), 400

    if audit_stage == 'penyusunan':
        results, debug_log = _run_penyusunan_automation(s, main_path_segment, debug_log)
    elif audit_stage == 'pemenuhan':
        results, debug_log = _run_pemenuhan_automation(s, main_path_segment, debug_log)
    else:
        return jsonify({"error": f"Tahapan audit tidak dikenal: {audit_stage}"}), 400

    return jsonify({"results": results, "debug_log": debug_log})

@app.route('/start-dynamic-automation', methods=['POST'])
def start_dynamic_automation():
    return jsonify({'error': 'Endpoint disabled. Gunakan /automation-run.'}), 410

if __name__ == '__main__':
    port = int(os.getenv('WRAPPER_PORT', '5001'))
    host = os.getenv('WRAPPER_HOST', '0.0.0.0')
    debug = os.getenv('WRAPPER_DEBUG', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
    app.run(host=host, port=port, debug=debug)
