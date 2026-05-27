const qrText = document.querySelector("#qrText");
const generateBtn = document.querySelector("#generateBtn");
const qrImage = document.querySelector("#qrImage");
const message = document.querySelector("#message");

generateBtn.addEventListener("click", async () => {
    message.textContent = "正在生成二维码...";

    const response = await fetch("/api/qrcode", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: qrText.value,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        message.textContent = result.error;
        return;
    }

    qrImage.src = result.image;
    message.textContent = "二维码生成成功";
});