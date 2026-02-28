"use strict";

class Tester{
	constructor(){
		this.last_answered = -1;
		this.answers = [];
		this.finished = false;
		
		this.init();
	}
	
	init(){
		this.init_tests_data();
		this.imgs_loaded = this.load_imgs();
		this.load_payment_options();
		this.built = this.build_elements();
	}
	
	intro(){
		this.container_el.classList.remove("hidden");
		this.select_page("intro");
	}
	
	async init_tests_data(){
		this.tests_data = [];
		const answer_counts = [6, 6, 8, 8, 8];
		
		for(let question_n = 0; question_n < 60; question_n++){
			const set_n = this.question_to_set_index(question_n);
			const question = {
				index: question_n,
				set_name: "ABCDE"[set_n],
				answers: []
			};
			this.tests_data.push(question);
			
			const answers_amount = +answer_counts[set_n];
			for(let answ_i = 0; answ_i < answers_amount; answ_i++){
				question.answers.push({});
			}
		}
	}
	
	load_payment_options(){
		this.payment_options = fetch("payment_options.json")
			.then(r => r.json());
	}
	
	async load_imgs(){
		const resp = await fetch("assets/img/tasks.zip");
		const blob = await resp.blob();
		const jszip = new JSZip();
		const zip_data = await jszip.loadAsync(blob);
		
		for(const [question_i, question] of this.tests_data.entries()){
			const img_name = `${question.set_name}-${question_i%12+1}.png`;
			const img_url = await _get_img_url(img_name);
			question.img_url = img_url;
		}
		
		async function _get_img_url(img_name){
			const img_data = await zip_data.file(img_name)
				.async("uint8array");
			const img_file = new File([img_data],
				"test.jpg", {type: "image/jpeg"});
			const img_url = URL.createObjectURL(img_file);
			return img_url;
		}
	}
	
	select_page(page_class){
		const current_page = this.container_el.querySelector(
			".tester-page.active");
		if(current_page)
			current_page.classList.remove("active");
		
		const new_page = this.container_el.querySelector(
			`.tester-page.${page_class}`);
		new_page.classList.add("active");
	}
	
	async build_elements(){
		this.container_el = document.createElement("div");
		this.container_el.classList.add("test-container");
		this.container_el.classList.add("hidden");
		document.body.append(this.container_el);
		
		this.container_el.append(this.build_intro_el());
		
		await this.imgs_loaded;
		this.container_el.append(this.build_questions_el());
		
		this.container_el.append(this.build_paywall_el());
	}
	
	build_intro_el(){
		const intro_el = document.createElement("div");
		intro_el.classList.add("intro");
		intro_el.classList.add("tester-page");
		
		const instruction_el = document
			.querySelector(".hidden-content .instruction");
		intro_el.append(instruction_el);
		const btn_panel_el = instruction_el.querySelector(".btn-panel");
		
		const start_btn_el = document.createElement("button");
		btn_panel_el.append(start_btn_el);
		start_btn_el.classList.add("start", "featured");
		start_btn_el.addEventListener("click", this.on_start.bind(this));
		
		const btn_text_el = document.createElement("span");
		btn_text_el.classList.add("text");
		btn_text_el.textContent = "Begin";
		start_btn_el.append(btn_text_el);
		
		const start_icon_el = document.createElement("span");
		start_icon_el.classList.add("icon");
		start_btn_el.append(start_icon_el);
		
		return intro_el;
	}
	
	build_questions_el(){
		const questions_el = document.createElement("div");
		questions_el.classList.add("questions");
		questions_el.classList.add("tester-page");
		
		const self = this;
		questions_el.addEventListener("dragstart", e => e.preventDefault());
		questions_el.addEventListener("click", e => {
			const question_el = e.target.closest(".question");
			const answer_el   = e.target.closest(".answer");
			if(!answer_el) return;
			
			const question_index = +question_el.dataset.index;
			const answer_index   = +answer_el.dataset.index;
			if(question_index != self.selected_question)
				return
			
			self.on_answer(question_index, answer_index);
		});
		
		questions_el.append(this.build_test_info_el());
		
		const questions_list_el = document.createElement("div");
		questions_list_el.classList.add("questions-list");
		questions_el.append(questions_list_el);
		
		
		for(const question of this.tests_data){
			const question_el = this.build_question_el(question)
			questions_list_el.append(question_el);
			question.element = question_el;
		}
		
		return questions_el;
	}
	
	build_test_info_el(){
		const self = this;
		const test_info_el = document.createElement("div");
		test_info_el.classList.add("test-info");
		
		test_info_el.append(this.build_timer_el());
		
		test_info_el.addEventListener("click", e => {
			if(e.target.classList.contains("point") &&
				e.target.classList.contains("accessible"))
				self.select_question(+e.target.dataset.index);
			
			const targ_set = e.target.closest(".set");
			if(targ_set)
				self.select_set(+targ_set.dataset.index);
		})
		
		const sets_el = document.createElement("div");
		sets_el.classList.add("sets");
		test_info_el.append(sets_el);
		
		const progress_el = document.createElement("div");
		progress_el.classList.add("progress");
		test_info_el.append(progress_el);
		
		const slider_el = document.createElement("div");
		slider_el.classList.add("slider");
		progress_el.append(slider_el);
		
		for(const [set_i, set_name] of Array.from("ABCDE").entries()){
			const set_el = document.createElement("button");
			set_el.classList.add("set");
			if(!set_i) set_el.classList.add("selected");
			set_el.dataset.index = set_i;
			sets_el.append(set_el);
			
			const set_progress_el = document.createElement("div");
			set_progress_el.classList.add("set-progress");
			set_el.append(set_progress_el);
			
			const set_progress_line_el = document.createElement("div");
			set_progress_line_el.classList.add("set-progress-line");
			set_progress_el.append(set_progress_line_el);
			
			const set_name_el = document.createElement("span");
			set_name_el.classList.add("set-name");
			set_name_el.textContent = set_name;
			set_el.append(set_name_el);
			
			const milestone_line_el = document.createElement("div");
			milestone_line_el.classList.add("milestone-line");
			slider_el.append(milestone_line_el);
			
			const progressbar_el = document.createElement("div");
			progressbar_el.classList.add("progressbar");
			milestone_line_el.append(progressbar_el);
			
			const progressline_el = document.createElement("div");
			progressline_el.classList.add("progressline");
			progressbar_el.append(progressline_el);
			
			for(let i = 0; i < 12; i++){
				const question_i = set_i * 12 + i;
				
				const point_el = document.createElement("div");
				point_el.classList.add("point");
				point_el.dataset.index = question_i;
				milestone_line_el.append(point_el);
				
				this.tests_data[question_i].nav_el = point_el;
				if(!question_i)
					point_el.classList.add("accessible");
			}
		}
		
		test_info_el.append(this.build_buttons_el());
		
		return test_info_el;
	}
	
	build_timer_el(){
		const timer_el = document.createElement("div");
		timer_el.classList.add("timer");
		
		const progress_el = document.createElement("div");
		progress_el.classList.add("progress");
		progress_el.textContent = "0/60";
		timer_el.append(progress_el);
		
		const time_left_el = document.createElement("div");
		time_left_el.classList.add("time-left");
		timer_el.append(time_left_el);
		
		return timer_el;
	}
	
	build_buttons_el(){
		const buttons_el = document.createElement("div");
		buttons_el.classList.add("buttons");
		
		const self = this;
		function add_button(cls, handler, text, parent, prepend_icon=false){
			const button_el = document.createElement("button");
			button_el.addEventListener("click", handler.bind(self));
			button_el.classList.add(...cls);
			parent.append(button_el);
			
			const text_el = document.createElement("span");
			text_el.classList.add("text");
			text_el.textContent = text;
			button_el.append(text_el);
			
			const icon_el = document.createElement("span");
			icon_el.classList.add("icon");
			if(prepend_icon)
				button_el.prepend(icon_el);
			else
				button_el.append(icon_el);
			
			return button_el;
		}
		
		add_button(["prev"],   this.on_go_prev, "Previous", buttons_el, true);
		add_button(["next"],   this.on_go_next, "Next",     buttons_el);
		add_button(["finish", "featured"],
			this.on_finish, "Finish", buttons_el);
		
		return buttons_el;
	}
	
	build_question_el(question){
		const question_el = document.createElement("div");
		question_el.dataset.answers_amount = question.answers.length;
		question_el.dataset.index = question.index;
		question_el.classList.add("question");
		
		const img_wrapper_el = document.createElement("div");
		img_wrapper_el.classList.add("question-img-wrapper");
		question_el.append(img_wrapper_el);
		
		const img_el = document.createElement("img");
		img_el.classList.add("question-img");
		img_el.classList.add("replace-black");
		img_el.src = question.img_url;
		img_wrapper_el.append(img_el);
		
		const answers_el = document.createElement("div");
		answers_el.classList.add("answers");
		question_el.append(answers_el);
		
		for(const [answ_i, answ] of question.answers.entries()){
			const answ_el = this.build_answer_el(question, answ_i);
			answers_el.append(answ_el);
			answ.element = answ_el;
		}
		
		return question_el;
	}
	
	build_answer_el(question, answ_i){
		const answer_el = document.createElement("button");
		answer_el.classList.add("answer");
		answer_el.dataset.index = answ_i;
		
		const img_wrapper_el = document.createElement("div");
		img_wrapper_el.classList.add("answer-img-wrapper");
		answer_el.append(img_wrapper_el);
		
		const img_el = document.createElement("img");
		img_el.classList.add("answer-img");
		img_el.classList.add("replace-black");
		img_el.src = question.img_url;
		img_wrapper_el.append(img_el);
		
		return answer_el;
	}
	
	build_paywall_el(){
		const paywall_el = document.createElement("div");
		paywall_el.classList.add("paywall");
		paywall_el.classList.add("tester-page");
		
		const animation_el = document
			.querySelector(".hidden-content .paywall-animation");
		paywall_el.append(animation_el);
		const panel_el = document
			.querySelector(".hidden-content .paywall-panel");
		paywall_el.append(panel_el);
		
		let age_resolve, name_resolve;
		this.user_age  = new Promise(resolve => age_resolve  = resolve);
		this.user_name = new Promise(resolve => name_resolve = resolve);
		
		const age_form_el = panel_el.querySelector("form.age");
		const name_form_el = panel_el.querySelector("form.name");
		const age_input_el = panel_el.querySelector(
			"form.age input[type=\"text\"]");
		const name_input_el = panel_el.querySelector(
			"form.name input[type=\"text\"]");
		const age_btn_el = panel_el.querySelector(
			"form.age button[type=\"submit\"]");
		const name_btn_el = panel_el.querySelector(
			"form.name button[type=\"submit\"]");
		
		age_input_el.addEventListener("input", e => {
			e.target.value = e.target.value.replaceAll(/[^0-9]*/g, "");
		});
		
		age_form_el.addEventListener("submit", e => {
			e.preventDefault();
			const age = +age_input_el.value;
			if(age && Number.isInteger(age)){
				age_input_el.disabled = true;
				age_btn_el.disabled = true;
				age_resolve(age);
			}
		})
		name_form_el.addEventListener("submit", e => {
			e.preventDefault();
			const name = name_input_el.value;
			if(name){
				name_input_el.disabled = true;
				name_btn_el.disabled = true;
				name_resolve(name);
			}
		})
		
		const self = this;
		panel_el.addEventListener("click", e => {
			const pay_btn_el = e.target.closest("button.choose");
			if(pay_btn_el)
				self.on_payment(+pay_btn_el.dataset.tier);
		});
		
		return paywall_el;
	}
	
	async run_timer(){
		const test_duration = 60 * 20; // seconds
		const time_left_el = this.container_el
			.querySelector(".timer .time-left");
		
		while(true){
			if(this.finished)
				return;
			
			const now = Math.floor(Date.now() / 1000);
			const since_start = now - this.started_at;
			const remaining = test_duration - since_start;
			
			time_left_el.textContent = _format(remaining);
			if(remaining <= 30)
				time_left_el.classList.add("ending");
			
			if(remaining <= 0){
				this.on_timeout();
				return;
			}
			
			await sleep(1000);
		}
		
		function _format(seconds){
			const seconds_part = seconds % 60;
			const minutes_part = (seconds - seconds_part) / 60;
			return _zfill(minutes_part, 2) + ":" + _zfill(seconds_part, 2)
		}
		function _zfill(val, len){
			const val_str = String(val);
			const missing_chars = Math.max(len - val_str.length);
			return "0".repeat(missing_chars) + val_str;
		}
	}
	
	on_answer(question_i, answ_i){
		this.tests_data[question_i].nav_el.classList.add("active");
		const next_question = this.tests_data[question_i+1];
		if(next_question)
			next_question.nav_el.classList.add("accessible")
		
		this.answers[question_i] = answ_i;
		this.last_answered = Math.max(question_i, this.last_answered);
		
		// mark answer as selected
		const question_el = this.tests_data[question_i].element;
		const prev_answer = question_el.querySelector(".answer.selected");
		if(prev_answer)
			prev_answer.classList.remove("selected");
		const new_answer = this.tests_data[question_i].answers[answ_i].element;
		new_answer.classList.add("selected");
		
		this.update_progress();
		
		if(question_i < 59){
			this.select_question(this.selected_question + 1);
		}
		this.update_nav_buttons();
	}
	
	async on_start(){
		const intro_el = this.container_el.querySelector(
			".intro.tester-page");
		const intro_scrolled = intro_el.scrollTop + intro_el.clientHeight
			>= intro_el.scrollHeight;
		
		if(!intro_scrolled){
			intro_el.scroll({top: 99999, behavior: "smooth"});
			return;
		}
		
		await this.built;
		
		this.started_at = Math.floor(Date.now() / 1000);
		this.run_timer();
		
		this.select_page("questions");
		this.select_question(0);
	}
	
	async on_finish(){
		this.finished = true;
		
		const current_selected = this.container_el.querySelector(
			".question.selected");
		if(current_selected)
			current_selected.classList.remove("selected");
		
		await sleep(150);
		this.launch_paywall();
	}
	
	async on_timeout(){
		const modal_el = document
			.querySelector(".hidden-content .timeout-modal");
		document.body.append(modal_el);
		await sleep(50); // to properly trigger modal show animation
		modal_el.classList.add("shown");
		
		let finish_resolve;
		const btn_clicked = new Promise(resolve => finish_resolve = resolve);
		const finish_btn = modal_el.querySelector("button.finish");
		finish_btn.addEventListener("click", e => finish_resolve());
		
		await btn_clicked;
		
		modal_el.classList.remove("shown");
		this.on_finish();
		
		await sleep(300);
		modal_el.remove();
	}
	
	on_go_next(){
		this.select_question(this.selected_question + 1);
	}
	
	on_go_prev(){
		this.select_question(this.selected_question - 1);
	}
	
	select_question(question_i){
		this.selected_question = question_i;
		
		const current_selected = this.container_el.querySelector(
			".question.selected");
		if(current_selected)
			current_selected.classList.remove("selected");
		
		this.tests_data[question_i].element.classList.add("selected");
		
		this.container_el.querySelector(".questions")
			.dataset.selected = question_i;
		
		this.update_nav_buttons();
		
		const selected_points = this.container_el.querySelectorAll(
			".milestone-line .point.current");
		selected_points.forEach(point_el => 
			point_el.classList.remove("current"));
		
		
		if(is_mobile()){
			const self = this;
			sleep(60).then(() =>
				self.tests_data[question_i].nav_el.classList.add("current"));
		} else {
			this.tests_data[question_i].nav_el.classList.add("current");
		}
		
		const set_i = this.question_to_set_index(question_i);
		this.select_set(set_i);
	}
	
	select_set(set_i){
		const selected_set_el = this.container_el
			.querySelector(".test-info .set.selected");
		if(selected_set_el)
			selected_set_el.classList.remove("selected");
		
		const new_set_el = this.container_el.querySelector(
			`.test-info .set:nth-of-type(${set_i+1})`);
		new_set_el.classList.add("selected");
		
		const nav_slider = this.container_el
			.querySelector(".progress .slider");
		nav_slider.style.left = `${set_i * -100}%`;
	}
	
	update_nav_buttons(){
		const prev_btn_el = this.container_el
			.querySelector(".test-info .prev");
		const next_btn_el = this.container_el
			.querySelector(".test-info .next");
		const finish_btn_el = this.container_el
			.querySelector(".test-info .finish");
		
		prev_btn_el.classList.remove("hidden");
		next_btn_el.classList.remove("hidden");
		finish_btn_el.classList.add("hidden");
		
		if(this.selected_question == 0)
			prev_btn_el.classList.add("hidden");
		
		if(this.selected_question == 59){
			next_btn_el.classList.add("hidden");
			if(this.last_answered == 59){
				finish_btn_el.classList.remove("hidden")
			}
		}
		
		if(this.last_answered < this.selected_question)
			next_btn_el.classList.add("hidden");
	}
	
	update_progress(){
		const progress_el = this.container_el
			.querySelector(".timer .progress");
		progress_el.textContent = `${this.last_answered+1}/60`;
		
		const milestone_lines = this.container_el
			.querySelectorAll(".test-info .milestone-line .progressline");
		const set_lines = this.container_el
			.querySelectorAll(".test-info .sets .set-progress-line");
		
		for(let set_i = 0; set_i < 5; set_i++){
			const milestone_line_el = milestone_lines[set_i];
			const set_line_el = set_lines[set_i];
			
			let answered_in_set = this.last_answered + 1 - set_i * 12;
			answered_in_set = answered_in_set > 12 ? 12 : answered_in_set;
			const progress11 = (100 / 11 * answered_in_set);
			const progress12 = (100 / 12 * answered_in_set);
			
			milestone_line_el.style.width = Math.min(progress11, 100) + "%";
			set_line_el.style.width = Math.min(progress12, 100) + "%";
		}
	}
	
	question_to_set_index(question_index){
		return (question_index - question_index % 12) / 12
	}
	
	async launch_paywall(){
		this.select_page("paywall");
		await sleep(400);
		
		const animation_el = this.container_el
			.querySelector(".paywall-animation");
		const list_items = Array.from(
			animation_el.querySelectorAll(".milestone-list > li"));
		
		const paywall_panel_el = this.container_el
			.querySelector(".paywall-panel");
		const submitting_item_el  = list_items[0];
		const calculating_item_el = list_items[1];
		const generating_item_el  = list_items[2];
		const chosing_item_el     = list_items[3];
		
		submitting_item_el.classList.add("active")
		await sleep(1000);
		submitting_item_el.classList.remove("active");
		submitting_item_el.classList.add("complete");
		
		calculating_item_el.classList.add("active");
		await sleep(600);
		this.select_paywall_panel_tab(0);
		const user_age = await this.user_age;
		calculating_item_el.classList.remove("active");
		calculating_item_el.classList.add("complete");
		
		generating_item_el.classList.add("active");
		await sleep(600);
		this.select_paywall_panel_tab(1);
		const user_name = await this.user_name;
		generating_item_el.classList.remove("active");
		generating_item_el.classList.add("complete");
		
		this.fill_result_cookie();
		chosing_item_el.classList.add("active");
		await sleep(600);
		this.select_paywall_panel_tab(2);
	}
	
	select_paywall_panel_tab(n){
		const panel_el = this.container_el
			.querySelector(".paywall-panel");
		const currently_selected = panel_el
			.querySelectorAll(":scope > .shown");
		
		if(n == -1){
			panel_el.classList.remove("active");
			panel_el.style.height = `0px`;
			return;
		}
		
		currently_selected.forEach(el => el.classList.remove("shown"));
		
		const target_el = this.container_el
			.querySelector(`.paywall-panel > *:nth-child(${n+1})`);
		
		panel_el.classList.add("active");
		target_el.classList.add("shown");
		panel_el.style.height = `${target_el.clientHeight}px`;
		
		const focus_targ = target_el.querySelector("*[data-autofocus='true']");
		if(focus_targ)
			focus_targ.focus();
	}
	
	async fill_result_cookie(){
		const data = {
			answers: this.answers,
			age: await this.user_age,
			user_name: await this.user_name
		}
		document.cookie = "tester_data=" + 
			encodeURIComponent(JSON.stringify(data));
	}
	
	async on_payment(tier){
		document.location = (await this.payment_options)[tier].url;
	}
}

function sleep(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

function is_mobile(){
	return /Android|iPhone/i.test(navigator.userAgent);
}


(function(){
	if(is_mobile()){
		document.body.classList.add("mobile");
	}else{
		document.body.classList.add("desktop");
		
		particlesJS.load("particles-target", "assets/particles-config.json",
			() => document.querySelector(".particles-js-canvas-el")
				.classList.add("loaded"));
	}
	
	window.tester = new Tester();
	
	const start_button_el = document.querySelector(".start-test");
	start_button_el.addEventListener("click", evt => {
		window.tester.intro();
		evt.target.closest("main").classList.add("faded");
	});
})();