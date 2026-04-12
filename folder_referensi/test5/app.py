from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request, send_file, session

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*_args, **_kwargs):
        return False


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "test4" / ".env")

app = Flask(__name__)
app.secret_key = os.getenv("WRAPPER_SECRET_KEY", "test5-dev-secret")

WEB2_URL = os.getenv("WEB2_URL", "http://180.214.246.148").rstrip("/")
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)

user_sessions = {}
session_meta = {}


def _session_id():
    return session.get("user_id")


def _current_session():
    user_id = _session_id()
    if not user_id:
        return None, None
    return user_sessions.get(user_id), session_meta.get(user_id, {})


def _build_selfassessment_main_path(scope):
    if scope == "audit":
        return "penyelenggara/audit/pq/selfassessment"
    if scope in {"inspeksi", "surveillance"}:
        return f"penyelenggara/{scope}/pq/selfassessment"
    return None


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


def _encode_webkit_multipart(fields, file_fields=None):
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex[:16]}"
    body_parts = []

    for file_field in file_fields or []:
        name = _escape_multipart_header(file_field["name"])
        filename = _escape_multipart_header(file_field["filename"])
        mimetype = file_field.get("mimetype") or "application/octet-stream"
        content = file_field["content"]
        body_parts.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode(),
                f"Content-Type: {mimetype}\r\n\r\n".encode(),
                content,
                b"\r\n",
            ]
        )

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


def _extract_fill_targets_from_html(html):
    soup = BeautifulSoup(html, "html.parser")
    targets = []
    seen = set()
    fill_pattern = re.compile(r"(?:^|/)fill/([^/]+)/([^/?#\"'\s]+)")

    for tag in soup.find_all("a"):
        href_value = str(tag.get("href") or "").strip()
        onclick_value = str(tag.get("onclick") or "").strip()
        for candidate in [href_value, onclick_value]:
            if not candidate:
                continue
            matched = fill_pattern.search(candidate)
            if not matched:
                continue
            code1, code2 = matched.group(1), matched.group(2)
            if (code1, code2) in seen:
                continue
            seen.add((code1, code2))
            targets.append(
                {
                    "plan_id": code1,
                    "area_group_id": code2,
                    "area": tag.get_text(" ", strip=True),
                    "href": href_value,
                }
            )
    return targets


def _build_konten_ref(ref_data):
    refs = []
    for item in ref_data or []:
        if not isinstance(item, dict):
            continue
        ref_no = " ".join(str(item.get("ref_konten_no") or "").split())
        ref_text = " ".join(str(item.get("ref_konten") or "").split())
        if ref_no and ref_text:
            refs.append(f"{ref_no} - {ref_text}")
        elif ref_no:
            refs.append(ref_no)
        elif ref_text:
            refs.append(ref_text)
    return "\n".join(dict.fromkeys(refs))


def _extract_question_text(pq_desc):
    text = " ".join(str(pq_desc or "").split())
    matched = re.match(r"^[A-Za-z]+(?:\.\d+)?\s*-\s*(.+)$", text)
    return matched.group(1).strip() if matched else text


def _is_question_row(datatable_item, detail_payload):
    pq_no = str(datatable_item.get("pq_no") or "").strip()
    if "." in pq_no:
        return True
    data_pq = (detail_payload.get("data_output") or {}).get("data_pq") or {}
    return "." in str(data_pq.get("pq_no") or "").strip()


def _fetch_plan_pq(base_session, main_path_segment, fill_url, plan_id, pq_id):
    worker_session = requests.Session()
    worker_session.cookies.update(base_session.cookies)
    url = f"{WEB2_URL}/{main_path_segment}/get_plan_pq"
    try:
        res = worker_session.get(
            url,
            params={"plan_id": plan_id, "pq_id": pq_id},
            headers=_ajax_headers(fill_url),
            timeout=60,
        )
        res.raise_for_status()
        return str(pq_id), res.json()
    except Exception as exc:
        return str(pq_id), {"error": f"Gagal mengambil get_plan_pq: {exc}"}


def _detail_to_draft_item(scope, area_group_id, area, datatable_item, detail_payload):
    data_output = detail_payload.get("data_output") or {}
    data_pq = data_output.get("data_pq") or {}
    ref_data = data_output.get("ref_data") or []
    data_files = data_output.get("data_files") or []

    plan_id = str(data_pq.get("plan_id") or datatable_item.get("plan_id") or "").strip()
    pq_id = str(data_pq.get("pq_id") or datatable_item.get("pq_id") or "").strip()
    pq_desc = data_output.get("pq_desc") or datatable_item.get("pq_desc") or ""
    konten_ref = _build_konten_ref(ref_data)
    comment = data_pq.get("comment") or ""
    evidence = data_pq.get("evidence") or ""
    ass_status = data_pq.get("ass_status") or "SA"

    return {
        "scope": scope,
        "area": area or "",
        "area_group_id": str(area_group_id or "").strip(),
        "plan_id": plan_id,
        "pq_id": pq_id,
        "data_id": str(data_pq.get("data_id") or "").strip(),
        "pq_no": data_pq.get("pq_no") or datatable_item.get("pq_no"),
        "pq_desc": pq_desc,
        "pertanyaan": _extract_question_text(pq_desc),
        "pq_guide": data_output.get("pq_guide") or "",
        "konten_ref": konten_ref,
        "ref_data": ref_data,
        "data_files": data_files,
        "editable": {
            "comment": comment,
            "ass_status": ass_status if ass_status in {"SA", "NA", "NS"} else "SA",
            "evidence": evidence,
        },
        "draft_payload": {
            "plan_id": plan_id,
            "area_group_id": str(area_group_id or "").strip(),
            "pq_id": pq_id,
            "is_file_exist": "1" if data_files else "0",
            "pq_desc": pq_desc,
            "konten_ref": konten_ref,
            "ass_status": ass_status if ass_status in {"SA", "NA", "NS"} else "SA",
            "comment": comment,
            "evidence": evidence,
            "status": "draft",
        },
        "raw_detail": detail_payload,
    }


def fetch_selfassessment_targets(s, scope, year):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {"error": f"Scope tidak valid: {scope}"}, []

    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    search_url = f"{main_page_url}/search_process"
    debug_log = [f"POST: {search_url}"]
    payload = {
        "ci_csrf_token": "",
        "bulan": "",
        "plan_tahun": str(year),
        "save": "Cari",
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": WEB2_URL,
        "Referer": main_page_url,
        "User-Agent": USER_AGENT,
    }

    try:
        res = s.post(search_url, data=payload, headers=headers, allow_redirects=True, timeout=120)
        res.raise_for_status()
    except Exception as exc:
        return {"error": f"Gagal mengambil daftar self assessment: {exc}"}, debug_log

    targets = _extract_fill_targets_from_html(res.text)
    for target in targets:
        target["fill_url"] = urljoin(main_page_url, target.get("href") or f"fill/{target['plan_id']}/{target['area_group_id']}")
        target["datatable_url"] = (
            f"{WEB2_URL}/{main_path_segment}/get_datatable/"
            f"{target['plan_id']}/{target['area_group_id']}"
        )
    debug_log.append(f"Self assessment fill links ditemukan: {len(targets)}")
    return {"scope": scope, "year": str(year), "targets": targets}, debug_log


def fetch_selfassessment_questions(s, scope, plan_id, area_group_id, area):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {"error": f"Scope tidak valid: {scope}"}, []

    main_page_url = f"{WEB2_URL}/{main_path_segment}"
    fill_url = f"{main_page_url}/fill/{plan_id}/{area_group_id}"
    datatable_url = f"{WEB2_URL}/{main_path_segment}/get_datatable/{plan_id}/{area_group_id}"
    debug_log = [f"GET: {datatable_url}"]

    try:
        datatable_res = s.get(datatable_url, headers=_ajax_headers(fill_url), timeout=120)
        datatable_res.raise_for_status()
        datatable_content = datatable_res.json()
    except Exception as exc:
        return {"error": f"Gagal mengambil datatable self assessment: {exc}"}, debug_log

    pq_items = []
    if (
        isinstance(datatable_content, list)
        and datatable_content
        and isinstance(datatable_content[0], dict)
        and isinstance(datatable_content[0].get("rs_pq"), list)
    ):
        pq_items = datatable_content[0]["rs_pq"]

    requests_to_make = []
    seen = set()
    for item in pq_items:
        if not isinstance(item, dict):
            continue
        item_plan_id = str(item.get("plan_id") or plan_id or "").strip()
        item_pq_id = str(item.get("pq_id") or "").strip()
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
                    _fetch_plan_pq,
                    s,
                    main_path_segment,
                    fill_url,
                    item_plan_id,
                    item_pq_id,
                ): item_pq_id
                for _, item_plan_id, item_pq_id in requests_to_make
            }
            for future in as_completed(future_map):
                pq_id_key, detail_payload = future.result()
                detail_by_pq_id[pq_id_key] = detail_payload

    questions = []
    for item, _, item_pq_id in requests_to_make:
        detail_payload = detail_by_pq_id.get(item_pq_id, {})
        if detail_payload.get("error") or not _is_question_row(item, detail_payload):
            continue
        draft_item = _detail_to_draft_item(scope, area_group_id, area, item, detail_payload)
        if not draft_item.get("data_id"):
            resolved_data_id, data_id_lookup = resolve_selfassessment_data_id(
                s=s,
                scope=scope,
                plan_id=draft_item["plan_id"],
                pq_id=draft_item["pq_id"],
                area_group_id=area_group_id,
            )
            if resolved_data_id:
                draft_item["data_id"] = resolved_data_id
                draft_item["data_id_lookup"] = data_id_lookup
                debug_log.append(
                    f"GET: {WEB2_URL}/{main_path_segment}/insert_realisasi/"
                    f"{draft_item['pq_id']}/{draft_item['plan_id']}"
                )
        questions.append(draft_item)
        debug_log.append(
            f"GET: {WEB2_URL}/{main_path_segment}/get_plan_pq"
            f"?plan_id={questions[-1]['plan_id']}&pq_id={questions[-1]['pq_id']}"
        )

    return {
        "scope": scope,
        "plan_id": str(plan_id),
        "area_group_id": str(area_group_id),
        "area": area or "",
        "fill_url": fill_url,
        "datatable_url": datatable_url,
        "datatable_content": datatable_content,
        "questions": questions,
    }, debug_log


def post_selfassessment_draft(s, payload_data):
    scope = (payload_data.get("scope") or "").strip()
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {"error": f"Scope tidak valid: {scope}"}, 422

    ass_status = (payload_data.get("ass_status") or "").strip()
    if ass_status not in {"SA", "NA", "NS"}:
        return {"error": "ass_status harus salah satu dari SA, NA, NS."}, 422

    required_fields = ["plan_id", "area_group_id", "pq_id", "pq_desc"]
    missing = [field for field in required_fields if not str(payload_data.get(field) or "").strip()]
    if missing:
        return {"error": f"Field wajib kosong: {', '.join(missing)}"}, 422

    plan_id = str(payload_data.get("plan_id")).strip()
    area_group_id = str(payload_data.get("area_group_id")).strip()
    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}"
    url = f"{WEB2_URL}/{main_path_segment}/fill_process"
    body = {
        "ci_csrf_token": payload_data.get("ci_csrf_token") or "",
        "plan_id": plan_id,
        "area_group_id": area_group_id,
        "pq_id": str(payload_data.get("pq_id") or "").strip(),
        "is_file_exist": str(payload_data.get("is_file_exist") or "0").strip(),
        "pq_desc": payload_data.get("pq_desc") or "",
        "konten_ref": payload_data.get("konten_ref") or "",
        "ass_status": ass_status,
        "comment": payload_data.get("comment") or "",
        "evidence": payload_data.get("evidence") or "",
        "status": "draft",
    }

    headers = _ajax_headers(fill_url)
    headers["Origin"] = WEB2_URL
    headers["Accept-Encoding"] = "gzip, deflate, br"
    headers["Connection"] = "keep-alive"
    try:
        multipart_body, boundary = _encode_webkit_multipart(list(body.items()))
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        res = s.post(url, data=multipart_body, headers=headers, timeout=120)
        res.raise_for_status()
    except Exception as exc:
        return {"error": f"Gagal simpan draft self assessment: {exc}"}, 502

    try:
        response_payload = res.json()
    except ValueError:
        response_payload = {"raw": res.text[:2000]}

    return {
        "status": "ok",
        "target_url": url,
        "request_payload": {key: value for key, value in body.items() if key != "ci_csrf_token"},
        "response": response_payload,
    }, 200


def resolve_selfassessment_data_id(s, scope, plan_id, pq_id, area_group_id):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return None, {"error": f"Scope tidak valid: {scope}"}

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


def inspect_selfassessment_file_after_upload(s, scope, plan_id, pq_id, area_group_id):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {"error": f"Scope tidak valid: {scope}"}

    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}"
    detail_url = f"{WEB2_URL}/{main_path_segment}/get_plan_pq"
    try:
        detail_res = s.get(
            detail_url,
            params={"plan_id": plan_id, "pq_id": pq_id},
            headers=_ajax_headers(fill_url),
            timeout=120,
        )
        detail_res.raise_for_status()
        detail_payload = detail_res.json()
    except Exception as exc:
        return {"error": f"Gagal inspect get_plan_pq setelah upload: {exc}"}

    data_files = ((detail_payload.get("data_output") or {}).get("data_files") or [])
    latest_file = data_files[-1] if data_files else None
    download_probe = None
    if isinstance(latest_file, dict) and latest_file.get("file_id"):
        download_url = f"{WEB2_URL}/{main_path_segment}/download_file/{latest_file['file_id']}"
        try:
            download_res = s.get(
                download_url,
                headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
                allow_redirects=False,
                timeout=120,
            )
            download_probe = {
                "url": download_url,
                "status_code": download_res.status_code,
                "location": download_res.headers.get("Location"),
                "content_type": download_res.headers.get("Content-Type"),
                "content_length": download_res.headers.get("Content-Length"),
                "content_disposition": download_res.headers.get("Content-Disposition"),
                "body_size": len(download_res.content or b""),
            }
        except Exception as exc:
            download_probe = {"error": f"Gagal probe download: {exc}"}

    return {
        "data_files_count": len(data_files),
        "latest_file": latest_file,
        "download_probe": download_probe,
    }


def upload_selfassessment_file(s, form_data, upload_file=None):
    scope = (form_data.get("scope") or "").strip()
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return {"error": f"Scope tidak valid: {scope}"}, 422

    plan_id = str(form_data.get("plan_id") or "").strip()
    area_group_id = str(form_data.get("area_group_id") or "").strip()
    pq_id = str(form_data.get("pq_id") or "").strip()
    data_id = str(form_data.get("data_id") or "").strip()
    missing = [
        name
        for name, value in {
            "plan_id": plan_id,
            "area_group_id": area_group_id,
            "pq_id": pq_id,
        }.items()
        if not value
    ]
    if missing:
        return {"error": f"Field wajib kosong: {', '.join(missing)}"}, 422

    data_id_lookup = None
    if not data_id:
        data_id, data_id_lookup = resolve_selfassessment_data_id(
            s=s,
            scope=scope,
            plan_id=plan_id,
            pq_id=pq_id,
            area_group_id=area_group_id,
        )
        if not data_id:
            return data_id_lookup, 502

    url = f"{WEB2_URL}/{main_path_segment}/upload_one_file"
    fill_url = f"{WEB2_URL}/{main_path_segment}/fill/{plan_id}/{area_group_id}"
    headers = _ajax_headers(fill_url)
    headers["Origin"] = WEB2_URL
    headers["Accept"] = "*/*"
    data = {"data_id": data_id, "plan_id": plan_id, "pq_id": pq_id}

    if upload_file is None:
        return {"error": "file_evidence wajib diisi."}, 422

    files = [
        (
            "file_evidence",
            (
                upload_file.filename,
                upload_file.stream,
                upload_file.mimetype or "application/octet-stream",
            ),
        )
    ]

    try:
        res = s.post(url, data=data, files=files, headers=headers, timeout=180)
        res.raise_for_status()
    except Exception as exc:
        return {"error": f"Gagal upload file self assessment: {exc}"}, 502

    try:
        response_payload = res.json()
    except ValueError:
        response_payload = {"raw": res.text[:2000]}

    post_upload_inspection = inspect_selfassessment_file_after_upload(
        s=s,
        scope=scope,
        plan_id=plan_id,
        pq_id=pq_id,
        area_group_id=area_group_id,
    )

    return {
        "status": "ok",
        "target_url": url,
        "data_id_lookup": data_id_lookup,
        "sent_filename": upload_file.filename,
        "request_payload": data,
        "response": response_payload,
        "post_upload_inspection": post_upload_inspection,
    }, 200


def download_selfassessment_file(s, scope, file_id):
    main_path_segment = _build_selfassessment_main_path(scope)
    if not main_path_segment:
        return jsonify({"error": f"Scope tidak valid: {scope}"}), 422

    file_id = str(file_id or "").strip()
    if not file_id:
        return jsonify({"error": "file_id wajib diisi."}), 422

    url = f"{WEB2_URL}/{main_path_segment}/download_file/{file_id}"
    try:
        res = s.get(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"}, allow_redirects=False, timeout=120)
    except Exception as exc:
        return jsonify({"error": f"Gagal download file self assessment: {exc}"}), 502

    content_type = (res.headers.get("Content-Type") or "").lower()
    if res.status_code >= 400:
        return jsonify({"error": f"DNP merespons {res.status_code} saat download file."}), 502
    if "text/html" in content_type and "login" in (res.url or "").lower():
        return jsonify({"error": "Session DNP kedaluwarsa. Login ulang diperlukan."}), 401
    if 300 <= res.status_code < 400 and not res.content:
        return jsonify(
            {
                "error": f"DNP merespons redirect {res.status_code} tanpa body file.",
                "location": res.headers.get("Location"),
            }
        ), 502

    output = send_file(
        io.BytesIO(res.content),
        mimetype=res.headers.get("Content-Type") or "application/octet-stream",
        as_attachment=True,
        download_name=f"dnp-selfassessment-file-{file_id}",
    )
    disposition = res.headers.get("Content-Disposition")
    if disposition:
        output.headers["Content-Disposition"] = disposition
    return output


@app.route("/")
def index():
    s = requests.Session()
    try:
        res = s.get(f"{WEB2_URL}/", timeout=60)
        soup = BeautifulSoup(res.text, "html.parser")
        csrf_input = soup.find("input", {"name": "ci_csrf_token"})
        captcha_img = soup.find("img", {"style": lambda value: "width: 164px" in value if value else False})
    except Exception as exc:
        return f"Gagal terhubung ke Web 2: {exc}", 502

    user_id = str(uuid.uuid4())
    session["user_id"] = user_id
    user_sessions[user_id] = s
    session_meta[user_id] = {
        "csrf": csrf_input.get("value", "") if csrf_input else "",
        "captcha_url": captcha_img.get("src", "") if captcha_img else "",
        "authenticated": False,
    }
    return render_template("index.html", meta=session_meta[user_id])


@app.route("/proxy-captcha")
def proxy_captcha():
    s, meta = _current_session()
    if not s:
        return "Session tidak valid", 403
    captcha_url = request.args.get("url") or meta.get("captcha_url")
    if not captcha_url:
        return "Captcha tidak ditemukan", 404
    img_res = s.get(captcha_url, timeout=60)
    return send_file(io.BytesIO(img_res.content), mimetype=img_res.headers.get("Content-Type") or "image/jpeg")


@app.route("/login", methods=["POST"])
def login():
    s, meta = _current_session()
    if not s:
        return "Session expired. Silakan refresh halaman.", 403

    payload = {
        "ci_csrf_token": request.form.get("ci_csrf_token") or meta.get("csrf", ""),
        "username": request.form.get("username") or "",
        "password": request.form.get("password") or "",
        "captcha": request.form.get("captcha") or "",
    }
    try:
        res = s.post(f"{WEB2_URL}/login/login_process", data=payload, allow_redirects=True, timeout=120)
    except Exception as exc:
        return f"Terjadi kesalahan saat login: {exc}", 502

    if "login" in (res.url or "").lower():
        return "Login gagal. Periksa username, password, dan captcha.", 401

    meta["authenticated"] = True
    session_meta[_session_id()] = meta
    return render_template("dashboard.html")


@app.route("/selfassessment/targets", methods=["POST"])
def selfassessment_targets():
    s, meta = _current_session()
    if not s or not meta.get("authenticated"):
        return jsonify({"error": "Session belum login."}), 401

    incoming = request.json or request.form
    scope = (incoming.get("scope") or "").strip()
    year = (incoming.get("year") or "").strip()
    if not year:
        return jsonify({"error": "Tahun wajib diisi."}), 422
    result, debug_log = fetch_selfassessment_targets(s, scope, year)
    status = 502 if result.get("error") else 200
    return jsonify({"results": result, "debug_log": debug_log}), status


@app.route("/selfassessment/questions", methods=["POST"])
def selfassessment_questions():
    s, meta = _current_session()
    if not s or not meta.get("authenticated"):
        return jsonify({"error": "Session belum login."}), 401

    incoming = request.json or request.form
    result, debug_log = fetch_selfassessment_questions(
        s=s,
        scope=(incoming.get("scope") or "").strip(),
        plan_id=(incoming.get("plan_id") or "").strip(),
        area_group_id=(incoming.get("area_group_id") or "").strip(),
        area=(incoming.get("area") or "").strip(),
    )
    status = 502 if result.get("error") else 200
    return jsonify({"results": result, "debug_log": debug_log}), status


@app.route("/selfassessment/save-draft", methods=["POST"])
def selfassessment_save_draft():
    s, meta = _current_session()
    if not s or not meta.get("authenticated"):
        return jsonify({"error": "Session belum login."}), 401

    incoming = request.json or request.form
    payload_data = dict(incoming)
    payload_data.setdefault("ci_csrf_token", meta.get("csrf", ""))
    result, status = post_selfassessment_draft(s, payload_data)
    return jsonify(result), status


@app.route("/selfassessment/upload-file", methods=["POST"])
def selfassessment_upload_file():
    s, meta = _current_session()
    if not s or not meta.get("authenticated"):
        return jsonify({"error": "Session belum login."}), 401
    result, status = upload_selfassessment_file(s, request.form, request.files.get("file_evidence"))
    return jsonify(result), status


@app.route("/selfassessment/download-file/<file_id>")
def selfassessment_download_file(file_id):
    s, meta = _current_session()
    if not s or not meta.get("authenticated"):
        return jsonify({"error": "Session belum login."}), 401
    scope = (request.args.get("scope") or "").strip()
    return download_selfassessment_file(s, scope, file_id)


if __name__ == "__main__":
    port = int(os.getenv("TEST5_PORT", "5005"))
    host = os.getenv("TEST5_HOST", "0.0.0.0")
    debug = os.getenv("TEST5_DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}
    app.run(host=host, port=port, debug=debug)
