// ===========================================================================
// main.js —— 这是网页的“交互大脑”（前端脚本，运行在浏览器里）。
// 它负责两件事：
//   1) 当你拖动滑块/改输入框时，实时调整二维码框的大小和位置；
//   2) 当你点“生成二维码”按钮时，把文字发给后端 app.py，再把返回的图片显示出来。
//
// 新手最容易懵的点：下面用到的 qrText、qrBox、generateBtn、message、
// qrImage、qrSize、qrX、qrY 这些变量，明明没有声明，为什么能直接用？
// 答案：浏览器有个规则——HTML 里凡是写了 id="xxx" 的元素，
// 浏览器会自动创建一个同名的全局变量 xxx 指向它。
// 所以这些名字其实就对应 index.html 里那些元素的 id。
// ===========================================================================

// 这个函数负责：根据滑块/输入框当前的值，更新二维码框 qrBox 的尺寸和位置。
function updateQrLayout() {
    // 把二维码框的宽度设为滑块 qrSize 的值（加上 "px" 单位，例如 "160px"）。
    qrBox.style.width = `${qrSize.value}px`;
    // 高度同样跟随 qrSize，保持正方形。
    qrBox.style.height = `${qrSize.value}px`;
    // 距离左边的位置 = 输入框 qrX 的值。
    qrBox.style.left = `${qrX.value}px`;
    // 距离顶部的位置 = 输入框 qrY 的值。
    qrBox.style.top = `${qrY.value}px`;
}

// 给三个调节器都绑定监听：只要它们的值一发生改变（input 事件），就重新布局一次。
qrSize.addEventListener("input", updateQrLayout); // 拖动“大小”滑块时
qrX.addEventListener("input", updateQrLayout);    // 修改“左边距 X”时
qrY.addEventListener("input", updateQrLayout);    // 修改“上边距 Y”时

// 给“生成二维码”按钮绑定点击动作。
// async 表示这是个异步函数，里面可以用 await “等待”后端慢慢返回结果，期间不会卡死页面。
generateBtn.addEventListener("click", async () => {
    // 先在提示区显示“正在生成”，让用户知道程序在工作。
    message.textContent = "正在生成二维码...";

    // 用 fetch 向后端的 /api/qrcode 发送请求。await 会等后端处理完再继续往下走。
    const response = await fetch("/api/qrcode", {
        method: "POST", // 用 POST，因为我们是在“提交”要生成二维码的文字
        headers: {
            // 告诉后端：我发过去的内容是 JSON 格式
            "Content-Type": "application/json",
        },
        // 把要发送的数据打包成 JSON 文本。qrText.value 就是输入框里的文字。
        body: JSON.stringify({
            text: qrText.value,
        }),
    });

    // 把后端返回的内容解析成 JSON 对象，例如 {"image": "..."} 或 {"error": "..."}。
    const result = await response.json();

    // response.ok 在状态码是 200 一类“成功”时为 true；失败（例如 400）时为 false。
    if (!response.ok) {
        // 失败：把后端给的错误信息显示出来，然后用 return 提前结束，不再往下执行。
        message.textContent = result.error;
        return;
    }

    // 成功：把后端返回的图片字符串塞进 qrImage 的 src，二维码就显示出来了。
    qrImage.src = result.image;
    message.textContent = "二维码生成成功";
});

// 页面刚加载时先调用一次，让二维码框按默认值（160 / 220 / 318）先摆放好。
// updateQrLayout();
