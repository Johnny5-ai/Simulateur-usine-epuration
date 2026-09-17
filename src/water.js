export function createWater({
  flow = 0,
  turbidity = 0,
  pH = 7,
  temperature = 15,
  ozoneResidual = 0,
  chlorineResidual = 0,
} = {}) {
  return { flow, turbidity, pH, temperature, ozoneResidual, chlorineResidual };
}

export function cloneWater(water) {
  return { ...water };
}
