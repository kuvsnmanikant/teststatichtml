import qrcode

# Just your hosted link — no need to encode it
url = "https://kuvsnmanikant.github.io/teststatichtml/weddinginvitation1.html"

qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("wedding_invite_qr.png")

print("✅ QR generated successfully! Scan it to open your wedding invitation.")
