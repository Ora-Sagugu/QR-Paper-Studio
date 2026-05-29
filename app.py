# ===========================================================================
# app.py —— 这是整个项目的“后端”（也叫服务器端）
# ---------------------------------------------------------------------------
# 一句话理解：这个文件启动后会变成一个小网站，做两件事：
#   1) 当浏览器访问首页时，把网页 index.html 发给浏览器；
#   2) 当网页点“生成二维码”按钮时，接收文字、生成二维码图片、再返回给网页。
#
# 整个项目的运行流程（不同文件如何联动）：
#   浏览器访问 "/" → app.py 返回 templates/index.html
#   → 网页加载 static/css/style.css（样式）和 static/js/main.js（交互）
#   → 用户点按钮，main.js 调用 "/api/qrcode"
#   → app.py 生成二维码并返回 → main.js 把图片显示出来
# ===========================================================================

# 从 flask 这个库里，导入我们要用到的 4 个工具：
#   Flask           ：用来创建“网站应用”这个对象
#   jsonify         ：把 Python 字典打包成 JSON 格式返回给网页（前后端通信的常用格式）
#   render_template ：读取 templates 文件夹里的网页文件并发给浏览器
#   request         ：代表“浏览器这次发来的请求”，里面装着网页传来的数据
from flask import Flask, jsonify, render_template, request

# base64 是一种“把图片等二进制数据变成纯文本字符串”的编码方式。
# 之所以要它，是因为我们不想把二维码存成文件，而是直接以文本形式塞进网页里显示。
import base64

# BytesIO 可以理解为“内存里的一个临时文件”。
# 我们把生成的二维码图片先写进这块内存，而不是写到硬盘上，速度快也不留垃圾文件。
from io import BytesIO

# qrcode 是真正负责“把文字变成二维码图片”的第三方库。
import qrcode

# 创建一个 Flask 应用对象，名字固定写成 app。
# __name__ 是 Python 的内置变量，告诉 Flask “当前文件在哪”，它据此去找 templates、static 文件夹。
app = Flask(__name__)

# @app.route("/") 是一个“路由”：当浏览器访问网站根地址（首页）时，执行下面这个函数。
@app.route("/")
def home():
    # 读取 templates/index.html 并把整页 HTML 发给浏览器显示。
    return render_template("index.html")

# 这是本项目的核心 API（接口）：网页通过它来索要二维码。
# methods=["POST"] 表示只接受 POST 请求（POST 通常用于“提交数据”，这里是提交要生成二维码的文字）。
@app.route("/api/qrcode", methods=["POST"])
def generate_qrcode():
    # 把网页发来的 JSON 数据解析成 Python 字典，例如 {"text": "你好"}。
    data = request.get_json()

    # 从字典里取出 "text" 的值；如果没有就用空字符串 ""。
    # .strip() 去掉文字首尾的空格，避免用户只输入了空格。
    text = data.get("text", "").strip()

    # 如果去空格后还是空的，说明用户没真正输入内容。
    # if not text:
    #     # 返回一段错误 JSON，并附带 HTTP 状态码 400（表示“请求有问题”）。
    #     return jsonify({"error": "请输入内容"}), 400

    # 用 qrcode 库把这段文字生成一张二维码图片对象。
    qr_image = qrcode.make(text)

    # 准备一块内存空间，待会把图片写进去（相当于一个临时文件）。
    buffer = BytesIO()
    # 把二维码图片以 PNG 格式保存到刚才那块内存里。
    qr_image.save(buffer, kind="PNG")

    # buffer.getvalue() 取出内存里的图片原始数据（二进制）。
    # base64.b64encode(...) 把二进制变成 base64 字节，再 .decode("utf-8") 变成普通文本字符串。
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    # 拼成网页 <img> 能直接识别的格式：data:image/png;base64,xxxxx
    # 这样网页不用再去下载文件，直接就能把这串文本当成图片显示。
    image_src = f"data:image/png;base64,{image_base64}"

    # 把图片字符串打包成 JSON 返回给网页，网页会把它塞进 <img> 标签显示出来。
    return jsonify({"image": image_src})

# 这一行的意思是：只有“直接运行这个文件”时，才启动网站服务。
# （如果这个文件是被别的文件 import 进去的，就不会自动启动。）
if __name__ == "__main__":
    # 启动服务。debug=True 表示开发模式：改了代码会自动重启，出错时网页会显示详细错误信息。
    app.run(debug=True)
