function updateQrLayout() {
    qrBox.style.width = `${qrSize.value}px`;
    qrBox.style.height = `${qrSize.value}px`;
    qrBox.style.left = `${qrX.value}px`;
    qrBox.style.top = `${qrY.value}px`;
}

qrSize.addEventListener("input", updateQrLayout);
qrX.addEventListener("input", updateQrLayout);
qrY.addEventListener("input", updateQrLayout);

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

updateQrLayout();