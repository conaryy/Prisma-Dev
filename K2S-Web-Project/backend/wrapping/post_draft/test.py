import requests

url = "http://180.214.246.148/penyelenggara/audit/cap/pemenuhan_cap/detail_process"

headers = {
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Origin": "http://180.214.246.148",
    "Referer": "http://180.214.246.148/penyelenggara/audit/cap/pemenuhan_cap/detail/A256027/17103",
}

cookies = {
    "te_jogja_session_": "0nhbjvqmouvr0srcltn6pig4af06toid",
}

data = {
    "ci_csrf_token": "",
    "plan_id": "A256027",
    "area_group_id": "17103",
    "cap_id": "3864",
    "step_id": "5414",
    "data_id": "398981",
    "data_st": "draft",
    "btn_action": "draft",
    "step_index": "2",
    "step_propose": "Perum LPPNPI Cabang Surabaya akan mengusulkan penyesuaian Serial Number peralatan VHF A/G - ER Surabaya Primary pada sertifikat 172 Perum LPPNPI Unit Blora.",
    "step_location": "Telah dilaksanakan sinkronisasi Sertifikat Penyelenggara Pelayanan Manajemen Lalu Lintas dan Telekomunikasi Penerbangan (CASR 172) Perum LPPNPI Cabang Surabaya oleh Tim DNP.\nPenyesuaian Serial Number didalam Sertifikat akan dilaksanakan bersamaan dengan proses amandemen Sertifikat pada periode selanjutnya.",
    "step_progress": "75",
    "step_evidence_ref": "Salinan BA Sinkronisasi Sertifikat Penyelenggara Pelayanan Manajemen Lalu Lintas dan Telekomunikasi Penerbangan Perum LPPNPI Cabang Surabaya",
    "step_complete_date": "2025-11-13",
    "save": "draft",
}

with open("/home/frhn/Desktop/file/PKL/K2S project/post_draft/test1/BA Sinkronisasi - Lampiran 3 Sertifikat Cabang Surabaya1.pdf", "rb") as f:
    files = {
        "file[]": ("BA Sinkronisasi - Lampiran 3 Sertifikat Cabang Surabaya1.pdf", f, "application/pdf")
    }
    r = requests.post(
        url,
        headers=headers,
        cookies=cookies,
        data=data,
        files=files,
        timeout=180
    )

print(r.status_code)
print(r.text[:1500])

