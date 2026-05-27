from flask import Flask, jsonify, render_template, request
import base64
from io import BytesIO
import qrcode

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/test-qr")
def test_qr():
    qr_image = qrcode.make("Hello QR Paper Studio")

    buffer = BytesIO()
    qr_image.save(buffer, format="PNG")

    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    image_src = f"data:image/png;base64,{image_base64}"

    return f'<img src="{image_src}" alt="二维码">'

@app.route("/api/qrcode", methods=["POST"])
def generate_qrcode():
    data = request.get_json()
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "请输入内容"}), 400

    qr_image = qrcode.make(text)

    buffer = BytesIO()
    qr_image.save(buffer, format="PNG")

    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    image_src = f"data:image/png;base64,{image_base64}"

    return jsonify({"image": image_src})



if __name__ == "__main__":
    app.run(debug=True)