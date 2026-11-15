export type Expression = 'idle' | 'talking' | 'thinking' | 'excited' | 'warning' | 'celebrating';
export interface Line {
  text: string;
  expression: Expression;
}
export const LINES = {
  hudOxygen: {
    text: "This blue sphere shows the oxygen in your astronaut's suit. It drains outside, even in the rover. Head inside to refill while the base has oxygen!",
    expression: 'thinking',
  },
  hudCycle: {
    text: 'The ring around your oxygen shows the Martian day and night cycle. The triangle points to where we are in the day. A day on Mars is called a sol!',
    expression: 'thinking',
  },
  hudEnergy: {
    text: "This lightning gauge shows the base's energy reserve. Solar panels make power in daylight, and the battery keeps our equipment running at night.",
    expression: 'thinking',
  },
  hudSupplies: {
    text: 'This gauge shows our food and water supplies. Caring for the garden and harvesting healthy plants helps feed our crew.',
    expression: 'thinking',
  },
  hudResearch: {
    text: 'This bar tracks our research. Collecting samples helps us learn about Mars and move toward our mission goal!',
    expression: 'thinking',
  },
  hudEvents: {
    text: 'This display shows what is happening around the base, like dust storms or extreme cold. Check it when conditions change!',
    expression: 'thinking',
  },
  hudSpeed: {
    text: 'These buttons control time. Pause stops the simulation, and one, two or three times changes its speed. In a shared room, only the coordinator can change these controls.',
    expression: 'thinking',
  },
  hudCrew: {
    text: 'Here is our room code and crew count. Up to four explorers can share a base. You can invite a friend using the room code.',
    expression: 'thinking',
  },
  hudChat: {
    text: 'This is our crew chat. Write a message here to plan a task or ask a teammate for help.',
    expression: 'thinking',
  },
  hudSettings: {
    text: 'This menu opens sound, graphics and game settings. You can also leave the expedition here. Tap me whenever you want to explore the displays again!',
    expression: 'thinking',
  },
  welcome: {
    text: "Hi, explorer! I'm B.I.T., your mission buddy. Let's discover our Mars base together!",
    expression: 'excited',
  },
  move: {
    text: 'Try walking a few steps! Click the ground, or use the arrow keys or W A S D.',
    expression: 'idle',
  },
  moveTouch: {
    text: 'Try walking a few steps! Tap an open spot on the ground.',
    expression: 'idle',
  },
  moved: {
    text: 'There you go! We can explore at your pace. Tap me whenever you need a hand.',
    expression: 'celebrating',
  },
  oxygen: {
    text: 'Our air filter needs care. Move the loose debris into the disposal opening to clear the way for air.',
    expression: 'thinking',
  },
  solar: {
    text: 'Dust blocks sunlight from reaching the solar cells. Sweep the brush across the dusty patches!',
    expression: 'thinking',
  },
  greenhouse: {
    text: 'These plants look thirsty. Hold the watering control to help each garden bed recover.',
    expression: 'thinking',
  },
  drill: {
    text: 'We can discover what is beneath Mars! Drill toward the requested layer, then collect a sample.',
    expression: 'excited',
  },
  plant: {
    text: 'A new seedling! Water helps it grow. We will need to care for it before harvesting.',
    expression: 'excited',
  },
  harvest: {
    text: 'Fresh food, grown on Mars! Your care helped these plants feed our crew.',
    expression: 'celebrating',
  },
  solarDone: {
    text: 'Look at those blue cells! With less dust, our panel can collect more sunlight.',
    expression: 'celebrating',
  },
  oxygenDone: {
    text: 'A clear filter! Air can pass through again. Our life support also needs power to work.',
    expression: 'celebrating',
  },
  greenhouseDone: {
    text: 'Happy plants! Keep caring for the garden as new Martian days begin.',
    expression: 'celebrating',
  },
  drillDone: {
    text: 'Sample collected! Studying these layers helps us understand Mars.',
    expression: 'celebrating',
  },
  drillMiss: {
    text: 'A sample from a different layer! Next time, watch the target layer before collecting.',
    expression: 'thinking',
  },
  rover: {
    text: 'Ready to explore on wheels? Click the ground or use the movement keys. Press E to step out.',
    expression: 'excited',
  },
  roverTouch: {
    text: 'Ready to explore on wheels? Tap the ground to drive. Use the exit button to step out.',
    expression: 'excited',
  },
  low: {
    text: "Your air tank is getting low. Let's head inside the base to refill it!",
    expression: 'warning',
  },
  recovered: {
    text: "You're safe inside. Your tank can refill while the base has oxygen available.",
    expression: 'idle',
  },
  storm: {
    text: 'A dust storm! Winds use up our suit oxygen faster. Staying inside is a good idea.',
    expression: 'warning',
  },
  blackout: {
    text: 'The base has run out of power. Check our solar panels when it is safe to go outside.',
    expression: 'warning',
  },
  difficulty: {
    text: 'That path did not work. Try an open spot nearby. We can find another way together!',
    expression: 'thinking',
  },
  solarHint: {
    text: 'Look for the orange patches that remain. Move the brush across those spots.',
    expression: 'thinking',
  },
  oxygenHint: {
    text: 'Pick up a loose piece and move it into the disposal opening. You can also select a piece, then select the opening.',
    expression: 'thinking',
  },
  greenhouseHint: {
    text: 'Hold the watering control for the thirsty garden bed. Check the other beds too!',
    expression: 'thinking',
  },
  drillHint: {
    text: 'If the drill is too hot, release the control and let it cool. Stop in the requested layer before collecting.',
    expression: 'thinking',
  },
  explore: {
    text: 'Look for a task marker near equipment. Choose something to explore, and I will come along!',
    expression: 'idle',
  },
  success: {
    text: 'We did it, explorer! Every discovery and every bit of care helped our mission.',
    expression: 'celebrating',
  },
  ended: {
    text: 'Our crew is heading to safety. We learned a lot together. We can try another expedition!',
    expression: 'idle',
  },
} satisfies Record<string, Line>;
export type LineId = keyof typeof LINES;
