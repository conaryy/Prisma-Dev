from flask import Flask, render_template, request, send_file, session, jsonify
import requests
from bs4 import BeautifulSoup
import io
import uuid
import re
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

    captcha_value = incoming.get('captcha')
    audit_type = incoming.get('type')
    audit_stage = incoming.get('stage')
    username = (incoming.get('username') or '').strip()
    password = (incoming.get('password') or '').strip()
    if not captcha_value:
        return jsonify({'error': 'Captcha wajib diisi'}), 400
    if not username or not password:
        return jsonify({'error': 'Username dan password wajib diisi'}), 400
    if action != 'login_only' and (not audit_type or not audit_stage):
        return jsonify({'error': 'Tipe dan Tahapan audit harus dipilih.'}), 400

    if not meta.get('authenticated'):
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
    port = int(os.getenv('WRAPPER_PORT', '5000'))
    host = os.getenv('WRAPPER_HOST', '0.0.0.0')
    debug = os.getenv('WRAPPER_DEBUG', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
    app.run(host=host, port=port, debug=debug)
