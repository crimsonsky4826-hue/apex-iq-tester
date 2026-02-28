"use strict";

/**
 * cert-generator.js
 *
 * Generates an IQ test certificate on an HTML Canvas element, using the
 * cert_tpl.jpg template image and the Lato font family (loaded via @font-face
 * in main.css).
 *
 * Expected DOM on the tier-3 result page (injected by the result Worker):
 *
 *   <div class="result cert"
 *        data-cert-id="<12-digit id>"
 *        data-user-name="<escaped name>"
 *        data-score="<integer>"
 *        data-submit-time="<unix timestamp seconds>">
 *     <div class="cert-loading">Generating your certificate…</div>
 *     <a class="cert-wrapper hidden" href="#" download="IQ-Certificate.jpg">
 *       <canvas class="cert-canvas"></canvas>
 *     </a>
 *   </div>
 *
 * Canvas drawing coordinates (derived from original Python/Pillow positions):
 *   - User name  : centered at y = 740   | Lato 300 (Light),   ~160 px
 *   - Score      : centered at y = 1150  | Lato 900 (Black),   ~200 px
 *   - Date       : centered at y = 1410  | Lato 300 (Light),    ~75 px
 *   - Cert ID    : left-aligned at (495, 1580) | Lato 400 (Regular), ~55 px
 *                  formatted as "XXXX XXXX XXXX"
 */

(async function () {
	const result_el = document.querySelector(".result.cert");
	if (!result_el) return;

	// ── Read data attributes embedded by the Worker ───────────────────────────
	const cert_id     = result_el.dataset.certId;
	const user_name   = result_el.dataset.userName;
	const score       = result_el.dataset.score;
	const submit_time = parseInt(result_el.dataset.submitTime, 10);

	const loading_el = result_el.querySelector(".cert-loading");
	const wrapper_el = result_el.querySelector(".cert-wrapper");
	const canvas_el  = result_el.querySelector(".cert-canvas");
	const ctx        = canvas_el.getContext("2d");

	try {
		// ── Load template image ───────────────────────────────────────────────
		const img = await load_image("/assets/img/cert_tpl.jpg");
		canvas_el.width  = img.naturalWidth;
		canvas_el.height = img.naturalHeight;
		const cx = canvas_el.width / 2;

		// ── Ensure all required font variants are loaded ──────────────────────
		// @font-face fonts are lazy-loaded; we must trigger loading explicitly
		// before attempting to use them in Canvas.
		await Promise.all([
			document.fonts.load("300 160px Lato"),   // Light  — name
			document.fonts.load("900 200px Lato"),   // Black  — score
			document.fonts.load("300 75px Lato"),    // Light  — date
			document.fonts.load("400 55px Lato"),    // Regular — cert ID
		]);

		// ── Draw template ─────────────────────────────────────────────────────
		ctx.drawImage(img, 0, 0);

		ctx.fillStyle = "#000000";

		// User name — Lato Light 160 px, horizontally centered at y = 740
		ctx.textAlign = "center";
		ctx.font = "300 160px Lato";
		ctx.fillText(user_name, cx, 740);

		// Score — Lato Black 200 px, horizontally centered at y = 1150
		ctx.font = "900 200px Lato";
		ctx.fillText(String(score), cx, 1150);

		// Date — Lato Light 75 px, horizontally centered at y = 1410
		ctx.font = "300 75px Lato";
		ctx.fillText(format_date(submit_time), cx, 1410);

		// Cert ID — Lato Regular 55 px, left-aligned at (495, 1580)
		ctx.textAlign = "left";
		ctx.font = "400 55px Lato";
		ctx.fillText(format_cert_id(cert_id), 495, 1580);

		// ── Export to JPEG blob and wire up the download link ─────────────────
		const blob = await canvas_to_blob(canvas_el, "image/jpeg", 0.92);
		const object_url = URL.createObjectURL(blob);

		wrapper_el.href = object_url;
		wrapper_el.classList.remove("hidden");
		loading_el.classList.add("hidden");

	} catch (err) {
		console.error("cert-generator: failed to generate certificate", err);
		loading_el.textContent = "Certificate generation failed. Please refresh the page.";
	}
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function load_image(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload  = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
		img.src = url;
	});
}

function canvas_to_blob(canvas, mime_type, quality) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			blob => blob ? resolve(blob) : reject(new Error("canvas.toBlob() returned null")),
			mime_type,
			quality
		);
	});
}

/**
 * Format a 12-digit numeric string as "XXXX XXXX XXXX".
 */
function format_cert_id(cert_id) {
	return cert_id.replace(/^(\d{4})(\d{4})(\d{4})$/, "$1 $2 $3");
}

/**
 * Format a Unix timestamp (seconds) as a long date string, e.g. "January 1, 2025".
 */
function format_date(timestamp_seconds) {
	const date = new Date(timestamp_seconds * 1000);
	return date.toLocaleDateString("en-US", {
		year:  "numeric",
		month: "long",
		day:   "numeric",
	});
}

