from __future__ import annotations

import hmac
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)

BACKEND_BASE_URL = os.getenv("WHATSAPP_BOT_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
BACKEND_INTERNAL_TOKEN = os.getenv("WHATSAPP_BOT_INTERNAL_TOKEN", "").strip()

WAHA_BASE_URL = os.getenv("WAHA_API_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
WAHA_API_KEY = os.getenv("WAHA_API_KEY", "").strip()
WAHA_SESSION = os.getenv("WAHA_SESSION_NAME", "default").strip() or "default"
WAHA_WEBHOOK_SECRET = os.getenv("WAHA_WEBHOOK_SECRET", "").strip()

BOT_MAX_ITEMS = max(1, int(os.getenv("WHATSAPP_BOT_MAX_ITEMS", "15")))
BOT_REQUEST_TIMEOUT = max(5, int(os.getenv("WHATSAPP_BOT_REQUEST_TIMEOUT", "30")))
WEBHOOK_DEDUP_TTL_SECONDS = max(10, int(os.getenv("WHATSAPP_BOT_DEDUP_TTL", "90")))
COMMAND_COOLDOWN_SECONDS = max(0, int(os.getenv("WHATSAPP_BOT_COMMAND_COOLDOWN", "300")))

processed_messages: dict[str, float] = {}
processed_command_fingerprints: dict[str, float] = {}


@dataclass
class ParsedCommand:
    kind: str
    scope: str = "all"
    year: int | None = None


def help_message() -> str:
    return (
        "PANDUAN BOT TEMUAN DNP\n"
        "\n"
        "Format command yang tersedia:\n"
        "\n"
        "  /help\n"
        "  /temuan all\n"
        "  /temuan audit all\n"
        "  /temuan audit 2025\n"
        "  /temuan inspeksi all\n"
        "  /temuan surveillance 2026\n"
        "\n"
        "Keterangan:\n"
        "\n"
        "/temuan all\n"
        "  Ringkasan total semua scope\n"
        "\n"
        "/temuan <scope> all\n"
        "  Daftar temuan per scope, semua tahun\n"
        "\n"
        "/temuan <scope> <tahun>\n"
        "  Daftar temuan per scope dan tahun\n"
        "\n"
        "Scope yang tersedia:\n"
        "  audit, inspeksi, surveillance"
    )


def parse_command(text: str) -> ParsedCommand | None:
    normalized = " ".join((text or "").strip().split())
    if not normalized:
        return None

    parts = normalized.lower().split(" ")
    if len(parts) == 1 and parts[0] == "/help":
        return ParsedCommand(kind="help")

    if not parts or parts[0] != "/temuan":
        return None

    if len(parts) == 2 and parts[1] == "all":
        return ParsedCommand(kind="summary")

    if len(parts) != 3:
        return ParsedCommand(kind="invalid")

    scope = parts[1]
    period = parts[2]
    if scope not in {"audit", "inspeksi", "surveillance"}:
        return ParsedCommand(kind="invalid")

    if period == "all":
        return ParsedCommand(kind="list", scope=scope)

    if re.fullmatch(r"\d{4}", period):
        return ParsedCommand(kind="list", scope=scope, year=int(period))

    return ParsedCommand(kind="invalid")


def backend_headers() -> dict[str, str]:
    if not BACKEND_INTERNAL_TOKEN:
        raise RuntimeError("WHATSAPP_BOT_INTERNAL_TOKEN wajib diisi.")
    return {
        "Accept": "application/json",
        "X-Internal-Token": BACKEND_INTERNAL_TOKEN,
    }


def extract_error_message(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    if isinstance(payload, dict):
        if isinstance(payload.get("error"), str) and payload["error"].strip():
            return payload["error"].strip()
        if isinstance(payload.get("message"), str) and payload["message"].strip():
            return payload["message"].strip()

    if response.text.strip():
        return trim_text(response.text.strip(), 240)

    return f"HTTP {response.status_code}"


def ensure_backend_ok(response: requests.Response) -> None:
    if response.ok:
        return
    raise RuntimeError(extract_error_message(response))


def fetch_temuan_summary() -> dict[str, Any]:
    return fetch_temuan_summary_filtered()


def fetch_temuan_summary_filtered(
    *,
    instansi: str | None = None,
    year: int | None = None,
    area: str | None = None,
) -> dict[str, Any]:
    response = requests.get(
        f"{BACKEND_BASE_URL}/api/internal/whatsapp/external-dnp/temuan",
        params=build_temuan_params(
            scope="all",
            view="summary",
            instansi=instansi,
            year=year,
            area=area,
        ),
        headers=backend_headers(),
        timeout=BOT_REQUEST_TIMEOUT,
    )
    ensure_backend_ok(response)
    payload = response.json()
    return payload.get("data", {})


def fetch_temuan_list(scope: str, year: int | None) -> dict[str, Any]:
    return fetch_temuan_list_filtered(scope=scope, year=year)


def fetch_temuan_list_filtered(
    *,
    scope: str,
    year: int | None = None,
    instansi: str | None = None,
    area: str | None = None,
) -> dict[str, Any]:
    params = build_temuan_params(
        scope=scope,
        view="list",
        instansi=instansi,
        year=year,
        area=area,
    )

    response = requests.get(
        f"{BACKEND_BASE_URL}/api/internal/whatsapp/external-dnp/temuan",
        params=params,
        headers=backend_headers(),
        timeout=BOT_REQUEST_TIMEOUT,
    )
    ensure_backend_ok(response)
    payload = response.json()
    return payload.get("data", {})


def build_temuan_params(
    *,
    scope: str,
    view: str,
    instansi: str | None = None,
    year: int | None = None,
    area: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {
        "scope": scope,
        "view": view,
    }
    if instansi:
        params["instansi"] = instansi
    if year is not None:
        params["year"] = year
    if area:
        params["area"] = area
    return params


def trim_text(value: str | None, limit: int) -> str:
    text = " ".join((value or "").split())
    if len(text) <= limit:
        return text
    return f"{text[: max(0, limit - 3)].rstrip()}..."


def format_summary_message(data: dict[str, Any]) -> str:
    summary = data.get("summary", {}) or {}
    by_scope = summary.get("byScope", {}) or {}
    by_instansi = list(summary.get("byInstansi", []) or [])

    lines = [
        "RINGKASAN TEMUAN DNP",
        "",
        f"Total pemenuhan CAP : {summary.get('totalTemuan', 0)}",
        f"Total instansi      : {summary.get('totalInstansi', 0)}",
        f"Total area          : {summary.get('totalArea', 0)}",
        f"Terpenuhi (100%)    : {summary.get('totalTerpenuhi', 0)}",
        f"Belum terpenuhi     : {summary.get('totalBelumTerpenuhi', 0)}",
        "",
        "Per Scope",
        f"  Audit        : {by_scope.get('audit', 0)}",
        f"  Inspeksi     : {by_scope.get('inspeksi', 0)}",
        f"  Surveillance : {by_scope.get('surveillance', 0)}",
    ]

    if by_instansi:
        lines += ["", "Per Instansi"]
        for item in by_instansi:
            instansi_name = item.get("instansiName") or "-"
            total_temuan = item.get("totalTemuan", 0)
            total_terpenuhi = item.get("totalTerpenuhi", 0)
            total_belum = item.get("totalBelumTerpenuhi", 0)
            lines += [
                f"\n{instansi_name}",
                f"  Total     : {total_temuan}",
                f"  Terpenuhi : {total_terpenuhi}",
                f"  Belum     : {total_belum}",
            ]

    return "\n".join(lines)


def format_list_message(data: dict[str, Any], scope: str, year: int | None) -> str:
    summary = data.get("summary", {}) or {}
    items = list(data.get("items", []) or [])

    period_label = f"tahun {year}" if year is not None else "semua tahun"

    if not items:
        return (
            f"Tidak ada temuan DNP\n"
            f"Scope   : {scope}\n"
            f"Periode : {period_label}"
        )

    lines = [
        f"TEMUAN DNP - {scope.upper()}",
        f"Periode : {period_label}",
        "",
        f"Total data     : {summary.get('totalTemuan', len(items))}",
        f"Total instansi : {summary.get('totalInstansi', 0)}",
        f"Terpenuhi      : {summary.get('totalTerpenuhi', 0)}",
        f"Belum terpenuhi: {summary.get('totalBelumTerpenuhi', 0)}",
    ]

    group_stats: dict[tuple[str, str, str], dict[str, int]] = {}
    group_progress: dict[tuple[str, str, str], dict[int, list[str]]] = {}
    for item in items:
        instansi = item.get("instansiName") or "-"
        area = item.get("area") or "-"
        schedule = item.get("schedule") or "-"
        group_key = (instansi, area, schedule)
        stats = group_stats.setdefault(
            group_key,
            {"total": 0, "terpenuhi": 0, "belum": 0},
        )
        stats["total"] += 1
        progress = int(item.get("progress") or 0)
        if progress >= 100:
            stats["terpenuhi"] += 1
        else:
            stats["belum"] += 1
        code = str(item.get("questionCode") or "-").strip() or "-"
        progress_groups = group_progress.setdefault(group_key, {})
        codes = progress_groups.setdefault(progress, [])
        if code not in codes:
            codes.append(code)

    for group_key, stats in group_stats.items():
        instansi, area, schedule = group_key
        lines += [
            "",
            f"{instansi}",
            f"  Area     : {area}",
            f"  Schedule : {schedule}",
            f"  Terpenuhi      : {stats.get('terpenuhi', 0)}",
            f"  Belum terpenuhi: {stats.get('belum', 0)}",
        ]

        progress_groups = group_progress.get(group_key, {})
        for progress in sorted(progress_groups.keys(), reverse=True):
            codes = progress_groups.get(progress, [])
            if not codes:
                continue
            joined_codes = ", ".join(f"[{code}]" for code in codes)
            lines += [
                f"  Progress {progress}% : {joined_codes}",
            ]

    return "\n".join(lines)


def verify_webhook_secret() -> bool:
    if not WAHA_WEBHOOK_SECRET:
        return True

    provided = (request.headers.get("X-Webhook-Secret") or "").strip()
    if provided:
        return hmac.compare_digest(provided, WAHA_WEBHOOK_SECRET)

    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return hmac.compare_digest(auth_header[7:].strip(), WAHA_WEBHOOK_SECRET)

    return False


def verify_internal_token() -> bool:
    if not BACKEND_INTERNAL_TOKEN:
        return False

    provided = (request.headers.get("X-Internal-Token") or "").strip()
    return bool(provided) and hmac.compare_digest(provided, BACKEND_INTERNAL_TOKEN)


def purge_processed_messages() -> None:
    now = time.time()
    expired_keys = [
        key for key, expires_at in processed_messages.items() if expires_at <= now
    ]
    for key in expired_keys:
        processed_messages.pop(key, None)

    expired_command_keys = [
        key
        for key, expires_at in processed_command_fingerprints.items()
        if expires_at <= now
    ]
    for key in expired_command_keys:
        processed_command_fingerprints.pop(key, None)


def extract_message(payload: dict[str, Any]) -> dict[str, Any] | None:
    candidate = payload.get("payload") if isinstance(payload.get("payload"), dict) else payload
    if not isinstance(candidate, dict):
        return None

    body = candidate.get("body")
    chat_id = candidate.get("chatId") or candidate.get("from")
    from_me = bool(candidate.get("fromMe"))
    nested_data = candidate.get("_data") if isinstance(candidate.get("_data"), dict) else {}
    message_id = (
        candidate.get("id")
        or candidate.get("messageId")
        or nested_data.get("id", {}).get("_serialized")
    )
    timestamp = candidate.get("timestamp") or candidate.get("time")

    if not isinstance(body, str) or not isinstance(chat_id, str) or chat_id.strip() == "":
        return None

    return {
        "body": body.strip(),
        "chat_id": chat_id.strip(),
        "from_me": from_me,
        "message_id": str(message_id).strip() if message_id else "",
        "timestamp": str(timestamp).strip() if timestamp else "",
    }


def build_message_dedup_key(message: dict[str, Any]) -> str:
    message_id = str(message.get("message_id") or "").strip()
    if message_id:
        return f"id:{message_id}"

    chat_id = str(message.get("chat_id") or "").strip()
    body = " ".join(str(message.get("body") or "").split()).lower()
    timestamp = str(message.get("timestamp") or "").strip()
    return f"fallback:{chat_id}:{timestamp}:{body}"


def build_command_fingerprint(message: dict[str, Any]) -> str:
    chat_id = str(message.get("chat_id") or "").strip().lower()
    body = " ".join(str(message.get("body") or "").split()).lower()
    return f"cmd:{chat_id}:{body}"


def should_process_message(message: dict[str, Any]) -> bool:
    purge_processed_messages()
    dedup_key = build_message_dedup_key(message)
    now = time.time()
    expires_at = processed_messages.get(dedup_key)
    if expires_at and expires_at > now:
        return False

    processed_messages[dedup_key] = now + WEBHOOK_DEDUP_TTL_SECONDS

    if COMMAND_COOLDOWN_SECONDS <= 0:
        return True

    command_fingerprint = build_command_fingerprint(message)
    command_expires_at = processed_command_fingerprints.get(command_fingerprint)
    if command_expires_at and command_expires_at > now:
        return False

    processed_command_fingerprints[command_fingerprint] = now + COMMAND_COOLDOWN_SECONDS
    return True


def send_waha_text(chat_id: str, text: str) -> None:
    payload = {
        "session": WAHA_SESSION,
        "chatId": chat_id,
        "text": text,
    }
    headers = {"Content-Type": "application/json"}
    if WAHA_API_KEY:
        headers["X-Api-Key"] = WAHA_API_KEY

    waha_base_url = WAHA_BASE_URL
    if waha_base_url.endswith("/api"):
        waha_base_url = waha_base_url[:-4]

    response = requests.post(
        f"{waha_base_url}/api/sendText",
        json=payload,
        headers=headers,
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(extract_error_message(response))


def waha_headers(*, accept_json: bool = True) -> dict[str, str]:
    headers: dict[str, str] = {}
    if accept_json:
        headers["Accept"] = "application/json"
    if WAHA_API_KEY:
        headers["X-Api-Key"] = WAHA_API_KEY
    return headers


def waha_api_url(path: str) -> str:
    waha_base_url = WAHA_BASE_URL
    if waha_base_url.endswith("/api"):
        waha_base_url = waha_base_url[:-4]
    return f"{waha_base_url}{path}"


def fetch_waha_session() -> dict[str, Any] | None:
    response = requests.get(
        waha_api_url(f"/api/sessions/{WAHA_SESSION}"),
        headers=waha_headers(),
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if response.status_code == 404:
        return None
    if not response.ok:
        raise RuntimeError(extract_error_message(response))
    payload = response.json()
    return payload if isinstance(payload, dict) else None


def create_waha_session() -> dict[str, Any]:
    response = requests.post(
        waha_api_url("/api/sessions"),
        json={"name": WAHA_SESSION},
        headers={**waha_headers(), "Content-Type": "application/json"},
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(extract_error_message(response))
    payload = response.json()
    return payload if isinstance(payload, dict) else {}


def start_waha_session() -> dict[str, Any]:
    response = requests.post(
        waha_api_url(f"/api/sessions/{WAHA_SESSION}/start"),
        json={},
        headers={**waha_headers(), "Content-Type": "application/json"},
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(extract_error_message(response))
    payload = response.json()
    return payload if isinstance(payload, dict) else {}


def restart_waha_session() -> dict[str, Any]:
    response = requests.post(
        waha_api_url(f"/api/sessions/{WAHA_SESSION}/restart"),
        json={},
        headers={**waha_headers(), "Content-Type": "application/json"},
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(extract_error_message(response))
    payload = response.json()
    return payload if isinstance(payload, dict) else {}


def logout_waha_session() -> dict[str, Any]:
    response = requests.post(
        waha_api_url(f"/api/sessions/{WAHA_SESSION}/logout"),
        json={},
        headers={**waha_headers(), "Content-Type": "application/json"},
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(extract_error_message(response))
    payload = response.json()
    return payload if isinstance(payload, dict) else {}


def fetch_waha_qr() -> dict[str, Any] | None:
    response = requests.get(
        waha_api_url(f"/api/{WAHA_SESSION}/auth/qr"),
        params={"format": "image"},
        headers=waha_headers(),
        timeout=BOT_REQUEST_TIMEOUT,
    )
    if response.status_code in {404, 409, 422}:
        return None
    if not response.ok:
        raise RuntimeError(extract_error_message(response))
    payload = response.json()
    return payload if isinstance(payload, dict) else None


def build_session_payload(*, ensure_qr: bool = True) -> dict[str, Any]:
    session = fetch_waha_session()
    if session is None:
        session = create_waha_session()

    status = str(session.get("status") or "UNKNOWN").upper()
    me = session.get("me")
    qr = None

    if status in {"STOPPED"}:
        session = start_waha_session() or session
        status = str(session.get("status") or status).upper()
        me = session.get("me")

    if status in {"FAILED"}:
        session = restart_waha_session() or session
        status = str(session.get("status") or status).upper()
        me = session.get("me")

    if ensure_qr and status in {"STARTING", "SCAN_QR_CODE", "FAILED", "STOPPED"}:
        qr = fetch_waha_qr()

    return {
        "sessionName": WAHA_SESSION,
        "status": status,
        "me": me if isinstance(me, dict) or me is None else None,
        "qr": qr,
    }


def normalize_phone_number(value: str) -> str:
    digits = re.sub(r"\D+", "", value or "")
    if not re.fullmatch(r"628\d{7,15}", digits):
        raise RuntimeError("Nomor WhatsApp harus berformat 62812345678.")
    return digits


def phone_number_to_chat_id(value: str) -> str:
    normalized = normalize_phone_number(value)
    return f"{normalized}@c.us"


def build_reply_for_text(text: str) -> str | None:
    parsed = parse_command(text)
    if parsed is None:
        return None
    if parsed.kind == "help":
        return help_message()
    if parsed.kind == "invalid":
        return help_message()
    if parsed.kind == "summary":
        return format_summary_message(fetch_temuan_summary())
    if parsed.kind == "list":
        return format_list_message(fetch_temuan_list(parsed.scope, parsed.year), parsed.scope, parsed.year)

    return help_message()


def build_runtime_error_reply(error: Exception) -> str:
    return (
        "Gagal Mengambil Data\n"
        "\n"
        "Bot tidak bisa mengambil data temuan saat ini.\n"
        f"Detail: {trim_text(str(error), 220)}"
    )


def build_admin_send_reply(
    *,
    scope: str,
    instansi: str | None = None,
    year: int | None = None,
    area: str | None = None,
) -> str:
    if scope == "all":
        return format_summary_message(
            fetch_temuan_summary_filtered(instansi=instansi, year=year, area=area)
        )

    return format_list_message(
        fetch_temuan_list_filtered(
            scope=scope,
            year=year,
            instansi=instansi,
            area=area,
        ),
        scope,
        year,
    )


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def index():
    return jsonify(
        {
            "status": "ok",
            "service": "whatsapp-bot",
            "webhook": "/webhook/waha",
        }
    )


@app.post("/command")
def command():
    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text wajib diisi."}), 422

    try:
        reply = build_reply_for_text(text)
    except Exception as exc:
        reply = build_runtime_error_reply(exc)

    return jsonify({"reply": reply or ""})


@app.post("/internal/send-temuan")
def internal_send_temuan():
    if not verify_internal_token():
        return jsonify({"error": "Unauthorized internal access."}), 403

    payload = request.get_json(silent=True) or {}
    phone_number = str(payload.get("phoneNumber") or "").strip()
    scope = str(payload.get("scope") or "all").strip().lower() or "all"
    instansi = str(payload.get("instansi") or "").strip() or None
    area = str(payload.get("area") or "").strip() or None
    raw_year = payload.get("year")

    if scope not in {"all", "audit", "inspeksi", "surveillance"}:
        return jsonify({"error": "Scope tidak valid."}), 422

    year: int | None = None
    if raw_year not in (None, ""):
        try:
            year = int(raw_year)
        except (TypeError, ValueError):
            return jsonify({"error": "Tahun tidak valid."}), 422

    try:
        chat_id = phone_number_to_chat_id(phone_number)
        reply = build_admin_send_reply(
            scope=scope,
            instansi=instansi,
            year=year,
            area=area,
        )
        send_waha_text(chat_id, reply)
    except Exception as exc:
        return jsonify({"error": trim_text(str(exc), 220)}), 502

    return jsonify(
        {
            "ok": True,
            "message": "Pesan WhatsApp berhasil dikirim.",
            "chatId": chat_id,
            "scope": scope,
            "instansi": instansi,
            "year": year,
            "area": area,
        }
    )


@app.post("/internal/send-text")
def internal_send_text():
    if not verify_internal_token():
        return jsonify({"error": "Unauthorized internal access."}), 403

    payload = request.get_json(silent=True) or {}
    phone_number = str(payload.get("phoneNumber") or "").strip()
    text = str(payload.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Text pesan wajib diisi."}), 422

    try:
        chat_id = phone_number_to_chat_id(phone_number)
        send_waha_text(chat_id, text)
    except Exception as exc:
        return jsonify({"error": trim_text(str(exc), 220)}), 502

    return jsonify(
        {
            "ok": True,
            "message": "Pesan WhatsApp berhasil dikirim.",
            "chatId": chat_id,
        }
    )


@app.get("/internal/session")
def internal_session():
    if not verify_internal_token():
        return jsonify({"error": "Unauthorized internal access."}), 403

    try:
        return jsonify({"ok": True, "data": build_session_payload()})
    except Exception as exc:
        return jsonify({"error": trim_text(str(exc), 220)}), 502


@app.post("/internal/session/logout")
def internal_session_logout():
    if not verify_internal_token():
        return jsonify({"error": "Unauthorized internal access."}), 403

    try:
        logout_waha_session()
        payload = build_session_payload()
        return jsonify(
            {
                "ok": True,
                "message": "Sesi WhatsApp berhasil logout.",
                "data": payload,
            }
        )
    except Exception as exc:
        return jsonify({"error": trim_text(str(exc), 220)}), 502


@app.post("/internal/session/new")
def internal_session_new():
    if not verify_internal_token():
        return jsonify({"error": "Unauthorized internal access."}), 403

    try:
        session = fetch_waha_session()
        if session is not None:
            logout_waha_session()
        payload = build_session_payload()
        return jsonify(
            {
                "ok": True,
                "message": "Sesi WhatsApp baru berhasil dibuat.",
                "data": payload,
            }
        )
    except Exception as exc:
        return jsonify({"error": trim_text(str(exc), 220)}), 502


@app.post("/webhook/waha")
def webhook_waha():
    if not verify_webhook_secret():
        return jsonify({"error": "Unauthorized webhook access."}), 403

    payload = request.get_json(silent=True) or {}
    message = extract_message(payload)
    if not message:
        return jsonify({"ok": True, "ignored": "unsupported-payload"})
    if message["from_me"]:
        return jsonify({"ok": True, "ignored": "from-me"})
    if not should_process_message(message):
        return jsonify({"ok": True, "ignored": "duplicate"})

    try:
        reply = build_reply_for_text(message["body"])
    except Exception as exc:
        reply = build_runtime_error_reply(exc)

    if not reply:
        return jsonify({"ok": True, "ignored": "not-a-command"})

    try:
        send_waha_text(message["chat_id"], reply)
    except Exception as exc:
        return jsonify({"error": f"Gagal mengirim balasan WAHA: {exc}"}), 502

    return jsonify({"ok": True})


@app.post("/")
def webhook_root():
    return webhook_waha()


if __name__ == "__main__":
    host = os.getenv("WHATSAPP_BOT_HOST", "0.0.0.0")
    port = int(os.getenv("WHATSAPP_BOT_PORT", "5100"))
    debug = os.getenv("WHATSAPP_BOT_DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}
    app.run(host=host, port=port, debug=debug)
