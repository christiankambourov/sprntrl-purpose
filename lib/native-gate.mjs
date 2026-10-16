import {nextCaptureState} from './native-state.mjs';

export function mountNativeGate({container, mock, initialState = 'idle', onState, onAccepted}) {
  let state = initialState;
  const frame = document.createElement('iframe');
  frame.title = 'Email signup';
  // Opaque origin: Kit cannot inspect the parent document or its storage.
  frame.setAttribute('sandbox', 'allow-scripts allow-forms');
  frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'border:0;width:100%;min-height:240px;display:block';
  frame.src = mock ? '/native-frame-mock.html' : '/native-frame.html';
  const handler = event => {
    if (event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.type !== 'purpose-kit') return;
    const {outcome, height} = event.data;
    if (Number.isFinite(height)) frame.style.height = Math.min(1000, Math.max(180, height + 12)) + 'px';
    if (outcome === 'ready-for-init') {
      frame.contentWindow.postMessage({type:'purpose-kit-init', state}, '*');
      return;
    }
    const next = nextCaptureState(state, outcome);
    if (next === state) return;
    state = next;
    onState(state);
    if (state === 'accepted') onAccepted({mode: mock ? 'preview' : 'kit'});
  };
  window.addEventListener('message', handler);
  container.replaceChildren(frame);
  return () => { window.removeEventListener('message', handler); frame.remove(); };
}
