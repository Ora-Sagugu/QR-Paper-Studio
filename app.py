"""
QR Paper Studio — Flask backend.

Serves the editor page and a single QR generation API. Layout, multi-code
state, A4 export, and print are handled entirely in static/js/main.js.
"""

from io import BytesIO
import base64

import qrcode
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


def build_qr_data_uri(text: str) -> str:
    """
    Encode text as a QR code PNG and return a data URI for inline <img> use.

    Args:
        text: Payload to encode (URL, plain text, etc.).

    Returns:
        String like ``data:image/png;base64,...``.
    """
    qr_image = qrcode.make(text)
    buffer = BytesIO()
    qr_image.save(buffer, kind="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{image_base64}"


@app.route("/")
def home():
    """Serve the main editor UI."""
    return render_template("index.html")


@app.route("/api/qrcode", methods=["POST"])
def generate_qrcode():
    """
    Generate one QR code from JSON body ``{"text": "..."}``.

    Returns:
        200 + ``{"image": "<data URI>"}`` on success.
        400 + ``{"error": "..."}`` when text is missing.
    """
    data = request.get_json()
    text = data.get("text", "").strip() if data else ""

    if not text:
        return jsonify({"error": "请输入内容"}), 400

    return jsonify({"image": build_qr_data_uri(text)})


if __name__ == "__main__":
    app.run(debug=True)
