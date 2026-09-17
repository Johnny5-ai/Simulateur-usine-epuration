/**
 * Moteur de scénarios : lit une liste d'événements horodatés (scriptés, pas
 * aléatoires) et les déclenche au bon moment de la simulation.
 * Format d'un événement : { t: minutes, type: string, payload: object }
 */
export function createScenarioEngine(events) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let nextIndex = 0;

  return {
    collectDueEvents(elapsedMinutes) {
      const due = [];
      while (nextIndex < sorted.length && sorted[nextIndex].t <= elapsedMinutes) {
        due.push(sorted[nextIndex]);
        nextIndex += 1;
      }
      return due;
    },

    reset() {
      nextIndex = 0;
    },

    isFinished() {
      return nextIndex >= sorted.length;
    },
  };
}
