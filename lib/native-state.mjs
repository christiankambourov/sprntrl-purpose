// Only observed native form outcomes advance capture. A timeout is not rejection.
export function nextCaptureState(current, outcome) {
  if (current === 'accepted') return current;
  if (outcome === 'pending' && ['idle', 'rejected'].includes(current)) return 'pending';
  if (['pending', 'uncertain'].includes(current) && ['accepted', 'rejected', 'uncertain'].includes(outcome)) return outcome;
  return current;
}
