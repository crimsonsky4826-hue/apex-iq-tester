/**
 * Cloudflare Pages Function: /accept_payment
 *
 * Called by Stripe after a successful checkout via the redirect URL:
 *   https://yourdomain.com/accept_payment?stripe_session_token={CHECKOUT_SESSION_ID}
 *
 * Ported from: src/server.py (accept_payment route) + src/tester.py (accept_payment, get_payment_tier, get_new_cert_id)
 *              + src/storage.py (get_payment_result, save_result, cert_id_exists)
 *
 * Environment variables required (set via Cloudflare Pages dashboard → Settings → Environment variables):
 *   STRIPE_API_KEY     — Stripe secret key
 *   TIER1_LINK_ID      — Stripe Payment Link ID for tier 1
 *   TIER2_LINK_ID      — Stripe Payment Link ID for tier 2
 *   TIER3_LINK_ID      — Stripe Payment Link ID for tier 3
 *
 * D1 binding required (wrangler.toml or Pages dashboard):
 *   DB — bound to the "iq-tester-db" D1 database
 */

export async function onRequestGet(context) {
	const { request, env } = context;
	const url = new URL(request.url);
	const payment_id = url.searchParams.get("stripe_session_token");

	// ── Read tester_data cookie ───────────────────────────────────────────────
	const cookie_str = request.headers.get("Cookie") || "";
	const cookie_match = cookie_str.match(/tester_data=([^;]+)/);
	if (!cookie_match || !payment_id) {
		return new Response("Missing session data", { status: 400 });
	}
	let tester_data;
	try {
		tester_data = JSON.parse(decodeURIComponent(cookie_match[1]));
	} catch {
		return new Response("Invalid cookie data", { status: 400 });
	}

	// ── Duplicate payment guard ───────────────────────────────────────────────
	const existing = await get_payment_result(env.DB, payment_id);
	if (existing) {
		return Response.redirect(
			`${url.origin}/result/tier-${existing.result_tier}/${existing.id}`, 302);
	}

	// ── Verify payment with Stripe ────────────────────────────────────────────
	const stripe_resp = await fetch(
		`https://api.stripe.com/v1/checkout/sessions/${payment_id}`, {
			headers: { "Authorization": `Bearer ${env.STRIPE_API_KEY}` }
		});
	if (!stripe_resp.ok) {
		return new Response("Failed to verify payment with Stripe", { status: 502 });
	}
	const session = await stripe_resp.json();

	if (session.status !== "complete" || session.payment_status !== "paid") {
		return new Response("Payment not complete", { status: 402 });
	}

	// ── Resolve tier ──────────────────────────────────────────────────────────
	const result_tier = get_payment_tier(session.payment_link, env);
	if (!result_tier) {
		return new Response("Unknown payment tier", { status: 400 });
	}

	// ── Compute score & save result ───────────────────────────────────────────
	// Score is pre-computed client-side and stored in the cookie.
	// If you want server-side scoring, port get_iq_score() here from tester.js.
	const score       = tester_data.score;
	const age         = tester_data.age;
	const user_name   = tester_data.user_name;
	const submit_time = Math.floor(Date.now() / 1000);
	const result_id   = await get_new_cert_id(env.DB);

	await save_result(env.DB,
		result_id, score, age, submit_time, payment_id, user_name, result_tier);

	return Response.redirect(
		`${url.origin}/result/tier-${result_tier}/${result_id}`, 302);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function get_payment_tier(payment_link_id, env) {
	if (payment_link_id === env.TIER1_LINK_ID) return 1;
	if (payment_link_id === env.TIER2_LINK_ID) return 2;
	if (payment_link_id === env.TIER3_LINK_ID) return 3;
	return null;
}

async function get_new_cert_id(DB) {
	while (true) {
		const digits = 12;
		const cert_id = String(
			Math.floor(Math.random() * (10 ** digits - 10 ** (digits - 1)))
			+ 10 ** (digits - 1)
		);
		const row = await DB.prepare(
			"SELECT 1 FROM results WHERE id = ?").bind(cert_id).first();
		if (!row) return cert_id;
	}
}

async function get_payment_result(DB, payment_id) {
	return await DB.prepare(
		"SELECT * FROM results WHERE payment_id = ?").bind(payment_id).first();
}

async function save_result(DB, id, score, age, submit_time, payment_id, user_name, result_tier) {
	await DB.prepare(
		"INSERT INTO results (id, score, age, submit_time, payment_id, user_name, result_tier) VALUES (?, ?, ?, ?, ?, ?, ?)"
	).bind(id, score, age, submit_time, payment_id, user_name, result_tier).run();
}

