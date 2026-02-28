/**
 * Cloudflare Pages Function: /result/* (catches /result/tier-N/<id>)
 *
 * Serves the result page for a given result ID.
 * Handles tier-1 expiry, tier-2 plain score, tier-3 certificate.
 *
 * Ported from: src/tester.py (get_result_page) + src/util.py (sanitize_html)
 *              + src/result_template.html
 *
 * Environment variables required:
 *   TEMP_LINK_LIFETIME_HOURS  — how long tier-1 links stay valid (e.g. "24")
 *   SHARETHIS_ADDIN           — ShareThis script tag HTML, or empty string
 *
 * D1 binding required:
 *   DB — bound to the "iq-tester-db" D1 database
 */

// result_template.html is served statically from public/; fetch it at runtime.
const TEMPLATE_PATH = "/result_template.html";

export async function onRequestGet(context) {
	const { request, env, params } = context;
	const url = new URL(request.url);

	// Path is like "tier-2/123456789012"
	const path_parts = (params.path || []);
	const result_id  = path_parts[path_parts.length - 1];

	// ── Fetch result from D1 ──────────────────────────────────────────────────
	const result = await env.DB.prepare(
		"SELECT * FROM results WHERE id = ?").bind(result_id).first();

	if (!result) {
		return new Response("Result not found", { status: 404 });
	}

	// ── Redirect if tier in URL doesn't match stored tier ────────────────────
	const tier_in_url = path_parts.length > 1
		? parseInt(path_parts[0].replace("tier-", ""))
		: null;
	if (tier_in_url !== result.result_tier) {
		return Response.redirect(
			`${url.origin}/result/tier-${result.result_tier}/${result.id}`, 302);
	}

	// ── Load HTML template ────────────────────────────────────────────────────
	const tpl_resp = await fetch(`${url.origin}${TEMPLATE_PATH}`);
	const template = await tpl_resp.text();

	// ── Build page ────────────────────────────────────────────────────────────
	const user_name = sanitize_html(result.user_name);
	const title     = `${user_name}'s IQ Test Result`;

	let og_meta_html = `
		<meta property="og:title" content="${title}" />
		<meta property="og:type" content="website" />
		<meta property="og:url" content="${url.origin}/result/tier-${result.result_tier}/${result.id}" />
		<meta property="og:description" content="${user_name} scored ${result.score} in Raven's IQ Test" />
		<meta property="og:site_name" content="Raven's IQ Test" />
	`;

	let main_html;

	if (result.result_tier === 1) {
		const lifetime_hours = parseInt(env.TEMP_LINK_LIFETIME_HOURS || "24");
		const expired_at     = result.submit_time + lifetime_hours * 3600;
		const now            = Math.floor(Date.now() / 1000);

		if (expired_at < now) {
			main_html = `
				<div class="result expired">
					<div class="desc">Result expired</div>
					<button onclick="document.location='/';" class='main-page'>Main page</button>
				</div>
			`;
			const page_html = template
				.replace("%title%", "Result expired")
				.replace("%sharethis%", "")
				.replace("%og_meta%", "")
				.replace("%main%", main_html);
			return new Response(page_html, {
				headers: { "Content-Type": "text/html; charset=utf-8" }
			});
		}
	}

	if (result.result_tier === 1 || result.result_tier === 2) {
		main_html = `
			<div class="result plain">
				<div class="name">${user_name}</div>
				<div class="desc">Your Raven's test IQ score:</div>
				<div class="score">${result.score}</div>
			</div>
		`;
	} else {
		// Tier 3 — certificate (generated client-side via Canvas in Phase 4)
		const cert_url = `${url.origin}/cert/${result.id}`;
		main_html = `
			<div class="result cert">
				<a class="cert-wrapper" href="${cert_url}" download="Certificate.jpg">
					<img src="${cert_url}" alt="${user_name}'s IQ certificate">
				</a>
			</div>
		`;
		og_meta_html += `\n<meta property="og:image" content="${cert_url}" />`;
	}

	const page_html = template
		.replace("%title%", title)
		.replace("%sharethis%", env.SHARETHIS_ADDIN || "")
		.replace("%og_meta%", og_meta_html)
		.replace("%main%", main_html);

	return new Response(page_html, {
		headers: { "Content-Type": "text/html; charset=utf-8" }
	});
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitize_html(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

