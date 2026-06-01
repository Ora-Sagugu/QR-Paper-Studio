"""
QR Paper Studio — Flask 后端（app.py）

职责边界：
- 本文件：提供首页 HTML、根据文字生成二维码图片（base64 data URI）
- static/js/main.js：多码排版、拖拽、Canvas 导出、打印（不经过后端）

关联：
- templates/index.html 由 render_template 返回
- main.js 通过 fetch POST /api/qrcode 获取 {"image": "data:image/png;base64,..."}
"""

from io import BytesIO
import base64

import qrcode
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


def build_qr_data_uri(text: str) -> str:
    """
    将文字编码为二维码 PNG，并转为可在 <img src> 中使用的 data URI。

    被 generate_qrcode() 调用；结果最终由前端存入 state.items[].imageSrc。
    """
    qr_image = qrcode.make(text)
    buffer = BytesIO()
    qr_image.save(buffer, kind="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{image_base64}"


@app.route("/")
def home():
    """GET / — 返回编辑器页面（index.html）。"""
    return render_template("index.html")


@app.route("/api/qrcode", methods=["POST"])
def generate_qrcode():
    """
    POST /api/qrcode — 生成单个二维码（前端每添加一个码调用一次）。

    请求体：{"text": "..."}
    成功：200 + {"image": "<data URI>"}
    失败：400 + {"error": "请输入内容"}
    """
    data = request.get_json()
    text = data.get("text", "").strip() if data else ""

    if not text:
        return jsonify({"error": "请输入内容"}), 400

    return jsonify({"image": build_qr_data_uri(text)})


if __name__ == "__main__":
    app.run(debug=True)
