/* Automotive Spirit: feedback form. Loaded only when the site has a feedback address (FEEDBACK_URL).
   "Send feedback" (footer) and "Report an error" (model sheets) open the form in a dialog. Nothing is sent
   until the reader presses Send, and then only the kind, the optional name, the message and the page address,
   to the address given by the link's data-feedback attribute, without cookies or referrer.
   Without JavaScript, the link leads to the contact section of the legal notice. */
(function () {
  "use strict";
  var link = document.querySelector("a[data-feedback]");
  if (!link || !window.fetch || typeof HTMLDialogElement !== "function") return;
  var endpoint = link.getAttribute("data-feedback");
  var legal = link.href.split("#")[0];
  document.documentElement.classList.add("has-feedback");
  var T = document.documentElement.lang === "fr" ? {
    bug: "Bug", wrong: "Information erronée", sugg: "Suggestion", close: "Fermer", title: "Envoyer un avis",
    about: "Il s'agit de", name: "Nom ou pseudonyme (facultatif)", message: "Votre message",
    notice: "Chaque message est d'abord trié par une IA, puis lu par une personne ; les messages injurieux sont " +
      "supprimés. Conservés 12 mois au plus : votre pseudonyme, votre message, l'adresse de cette page et la date. " +
      "Ni adresse IP, ni cookie. ", details: "Détails", cancel: "Annuler", send: "Envoyer",
    choose: "Choisissez de quoi il s'agit.", short: "Écrivez quelques mots dans votre message.", sending: "Envoi…",
    thanks: "Merci, votre message a bien été reçu.",
    busy: "Beaucoup de messages arrivent en ce moment : réessayez dans quelques minutes.",
    failed: "Le message n'a pas pu être envoyé. Réessayez plus tard, ou écrivez à l'adresse des mentions légales.",
    offline: "Le message n'a pas pu être envoyé. Vérifiez votre connexion, ou écrivez à l'adresse des mentions légales."
  } : {
    bug: "Bug", wrong: "Wrong information", sugg: "Suggestion", close: "Close", title: "Send feedback",
    about: "This is about", name: "Name or pseudonym (optional)", message: "Your message",
    notice: "Every message is first sorted by an AI, then read by a person; abusive messages are deleted. " +
      "Kept for 12 months at most: your pseudonym, your message, this page's address and the date. " +
      "No IP address, no cookie. ", details: "Details", cancel: "Cancel", send: "Send",
    choose: "Choose what this is about.", short: "Write a few words in your message.", sending: "Sending…",
    thanks: "Thank you, your message has been received.",
    busy: "Many messages are arriving right now: please try again in a few minutes.",
    failed: "The message could not be sent. Please try again later, or write to the address in the legal notice.",
    offline: "The message could not be sent. Check your connection, or write to the address in the legal notice."
  };

  var KINDS = [["bug", T.bug], ["error", T.wrong], ["suggestion", T.sugg]];
  var dialog = null, form = null, status = null, sendButton = null;

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }

  function build() {
    dialog = el("dialog", { "class": "fb-dialog", "aria-labelledby": "fb-title" });
    form = el("form", { "class": "fb-form", "novalidate": "" });
    var close = el("button", { type: "button", "class": "fb-close", "aria-label": T.close }, "×");
    close.addEventListener("click", function () { dialog.close(); });
    form.appendChild(close);
    form.appendChild(el("h2", { id: "fb-title" }, T.title));

    var kinds = el("fieldset", { "class": "fb-kinds" });
    kinds.appendChild(el("legend", {}, T.about));
    KINDS.forEach(function (k) {
      var label = el("label", { "class": "fb-kind" });
      var input = el("input", { type: "radio", name: "kind", value: k[0], required: "" });
      label.appendChild(input);
      label.appendChild(el("span", {}, k[1]));
      kinds.appendChild(label);
    });
    form.appendChild(kinds);

    var nameLabel = el("label", { "class": "fb-field" });
    nameLabel.appendChild(el("span", {}, T.name));
    nameLabel.appendChild(el("input", { type: "text", name: "name", maxlength: "60", autocomplete: "nickname" }));
    form.appendChild(nameLabel);

    var messageLabel = el("label", { "class": "fb-field" });
    messageLabel.appendChild(el("span", {}, T.message));
    var message = el("textarea", { name: "message", rows: "6", maxlength: "2000", minlength: "5", required: "" });
    messageLabel.appendChild(message);
    var count = el("span", { "class": "fb-count", "aria-hidden": "true" }, "0 / 2000");
    message.addEventListener("input", function () { count.textContent = message.value.length + " / 2000"; });
    messageLabel.appendChild(count);
    form.appendChild(messageLabel);

    // Robots fill every field; people never see this one.
    var trap = el("div", { "class": "fb-trap", "aria-hidden": "true" });
    trap.appendChild(el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off" }));
    form.appendChild(trap);

    var notice = el("p", { "class": "fb-notice" },
      T.notice);
    var more = el("a", { href: legal + "#feedback" }, T.details);
    notice.appendChild(more);
    form.appendChild(notice);

    status = el("p", { "class": "fb-status", role: "status", "aria-live": "polite" });
    form.appendChild(status);

    var actions = el("div", { "class": "fb-actions" });
    var cancel = el("button", { type: "button", "class": "fb-secondary" }, T.cancel);
    cancel.addEventListener("click", function () { dialog.close(); });
    sendButton = el("button", { type: "submit", "class": "fb-primary" }, T.send);
    actions.appendChild(cancel);
    actions.appendChild(sendButton);
    form.appendChild(actions);

    form.addEventListener("submit", submit);
    dialog.appendChild(form);
    dialog.addEventListener("click", function (ev) { if (ev.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
  }

  function say(text, isError) {
    status.textContent = text;
    status.classList.toggle("fb-error", !!isError);
  }

  function submit(ev) {
    ev.preventDefault();
    var kind = form.querySelector("input[name=kind]:checked");
    var text = form.elements.message.value.trim();
    if (!kind) { say(T.choose, true); return; }
    if (text.length < 5) { say(T.short, true); form.elements.message.focus(); return; }
    sendButton.disabled = true;
    say(T.sending);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      body: JSON.stringify({
        kind: kind.value,
        name: form.elements.name.value.trim(),
        message: text,
        page: location.origin + location.pathname,
        website: form.elements.website.value
      })
    }).then(function (r) {
      if (r.status === 201) {
        form.reset();
        form.querySelector(".fb-count").textContent = "0 / 2000";
        say(T.thanks);
        form.querySelector(".fb-secondary").textContent = T.close;
        return;
      }
      if (r.status === 429) { say(T.busy, true); return; }
      say(T.failed, true);
    }).catch(function () {
      say(T.offline, true);
    }).then(function () { sendButton.disabled = false; });
  }

  function open(kind) {
    if (!dialog) build();
    say("");
    form.querySelector(".fb-secondary").textContent = T.cancel;
    if (kind) {
      var radio = form.querySelector("input[name=kind][value=" + kind + "]");
      if (radio) radio.checked = true;
    }
    if (!dialog.open) dialog.showModal();
    (kind ? form.elements.message : form.querySelector("input[name=kind]")).focus();
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("a[data-feedback], [data-feedback-kind]");
    if (!t) return;
    ev.preventDefault();
    open(t.getAttribute("data-feedback-kind"));
  });
})();
