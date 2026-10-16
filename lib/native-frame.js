/* Kit owns the live POST. This bridge observes its rendered outcome, not a
   guessed callback or redirect. The sandbox denies access to parent answers. */
(() => {
  const config = window.PURPOSE_NATIVE_CONFIG || { mode: 'disabled' };
  const mock = config.mode === 'mock' && ['127.0.0.1', 'localhost'].includes(location.hostname);
  // Deployment remains deliberately disabled pending publication approval.
  const live = config.mode === 'live';
  const form = document.querySelector('form.formkit-form');
  const input = form.querySelector('[name="email_address"]');
  const button = form.querySelector('[data-element="submit"]');
  const status = document.getElementById('frameStatus');
  let state = 'idle', timer, ready = false, attempts = 0, initialized = false;
  let knownMockRejection = false, vendorError = false;
  const send = outcome => parent.postMessage({ type: 'purpose-kit', outcome, height: document.body.scrollHeight }, '*');
  function setState(next, message) {
    state = next;
    status.textContent = message;
    const locked = !ready || ['pending', 'uncertain', 'accepted'].includes(state);
    button.disabled = locked;
    input.readOnly = locked;
    send(next);
  }
  button.disabled = true;
  form.querySelector('[data-element="submit"] span').textContent = 'Join list & see results';
  input.maxLength = 254;
  input.autocomplete = 'email';
  // No answers, reflection, score, email or subscriber ID cross this bridge.
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'purpose-kit-init' || initialized) return;
    initialized = true;
    if (['pending', 'uncertain', 'accepted'].includes(event.data.state)) {
      setState(event.data.state === 'accepted' ? 'accepted' : 'uncertain', 'A previous signup may have been accepted. Please contact christian@sprntrl.co before trying again.');
      return;
    }
    if (!mock && !live) {
      status.textContent = 'Live signup is disabled in this review preview. No address will be submitted.';
      send('ready');
      return;
    }
    {
      // Kit expects localStorage. Give it memory confined to this opaque frame,
      // never parent storage or a persistent cross-visit subscriber identifier.
      const memory = new Map();
      try {
        Object.defineProperty(window, 'localStorage', {configurable:true, value:{
          getItem:key => memory.has(String(key)) ? memory.get(String(key)) : null,
          setItem:(key,value) => memory.set(String(key), String(value)),
          removeItem:key => memory.delete(String(key)), clear:() => memory.clear(),
          key:index => [...memory.keys()][index] ?? null, get length(){return memory.size;}
        }});
      } catch {
        status.textContent = 'Signup could not initialize safely. No address was submitted.'; send('unavailable'); return;
      }
      window.addEventListener('error', () => { vendorError = true; ready = false; button.disabled = true; status.textContent = 'Signup could not initialize. Your answers are still here.'; });
      if (mock) {
        // Real, saved Kit handler + mocked transport; CSP also blocks all network.
        window.fetch = async (url, options) => {
          if (String(url) !== form.action) return {ok:true, json:async()=>({})};
          attempts++;
          const email = options.body.get('email_address')?.trim().toLowerCase();
          if (!email?.endsWith('@example.com')) throw new Error('Synthetic addresses only');
          if (email === 'timeout@example.com') return new Promise(() => {});
          if (email === 'network@example.com') throw new Error('Simulated lost response');
          await new Promise(resolve => setTimeout(resolve, 600));
          knownMockRejection = email === 'fail@example.com' || (email === 'retry@example.com' && attempts === 1);
          return {ok:true, json:async()=> knownMockRejection
            ? {status:'error',errors:{messages:['Simulated provider rejection. Please try again.']}}
            : {status:'success'}};
        };
      }
      const script = document.createElement('script');
      script.src = mock ? '/fixtures/kit-vendor.js' : 'https://f.convertkit.com/ckjs/ck.5.js';
      script.onload = () => {
        if (vendorError || !window.__sv_forms?.some(entry => entry.element === form && entry.initialized)) {
          status.textContent = 'Signup could not initialize. No address was submitted.'; send('unavailable'); return;
        }
        ready = true;
        status.textContent = mock ? 'SIMULATION ONLY · Real Kit form code, mocked transport. Use an @example.com address.' : '';
        button.disabled = false; send('ready');
      };
      script.onerror = () => { status.textContent = 'Signup could not load. Your answers are still here. Reload to try loading it again.'; send('unavailable'); };
      document.body.appendChild(script);
    }
  });
  form.addEventListener('submit', event => {
    if (!ready || !['idle', 'rejected'].includes(state) || !input.checkValidity()) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (config.approvedEmail && input.value.trim().toLowerCase() !== config.approvedEmail) {
      event.preventDefault(); event.stopImmediatePropagation(); status.textContent = 'This test is limited to the approved address.'; return;
    }
    if (mock && !input.value.trim().toLowerCase().endsWith('@example.com')) {
      event.preventDefault(); event.stopImmediatePropagation();
      status.textContent = 'Use an @example.com address for this simulation.'; return;
    }
    // Capture before Kit's own handler, but leave the native input enabled so
    // Kit can serialize it. Block every later submit while the first is pending.
    knownMockRejection = false;
    form.querySelector('[data-element="errors"]').replaceChildren();
    setState('pending', 'Saving your signup…');
    timer = setTimeout(() => setState('uncertain', 'We could not confirm the outcome yet. Your answers are safe. Please contact christian@sprntrl.co before trying again.'), mock && input.value.startsWith('timeout@') ? 1200 : 15000);
  }, true);
  new MutationObserver(() => {
    if (!['pending', 'uncertain'].includes(state)) return;
    const success = form.querySelector('.formkit-alert-success');
    const expected = JSON.parse(form.dataset.options).settings.after_subscribe.success_message;
    if (success && success.textContent.trim() === expected) {
      clearTimeout(timer);
      setState('accepted', mock ? 'Simulated signup accepted. No address was stored.' : 'Signup accepted. Your results are ready.');
    } else if (form.querySelector('[data-element="errors"]')?.textContent.trim()) {
      clearTimeout(timer);
      if (mock && knownMockRejection) setState('rejected', 'Signup was not accepted. Your answers are still here. You can correct the address or retry.');
      else setState('uncertain', 'We could not confirm the outcome. Your answers are still here. Please contact christian@sprntrl.co before trying again.');
    }
  }).observe(form, { childList: true, subtree: true, characterData: true });
  new ResizeObserver(() => send('resize')).observe(document.body);
  send('ready-for-init');
})();
