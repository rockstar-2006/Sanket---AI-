/**
 * Sanket AI - Real-Time Contextual Sentence Composer
 * Fuses Indian Sign Language (ISL) gestures and A-Z fingerspelling
 * with conversation context to generate fluent, natural daily and professional sentences.
 */

export interface ComposedSentenceResult {
  sentence: string;
  source: 'contextual-template' | 'ai-gemini' | 'direct';
  intent: string;
  confidence: number;
}

interface ContextualRules {
  [domainId: string]: {
    [dialogueStep: number]: {
      [tokenKeyword: string]: string;
    };
    defaultTokenMap: {
      [tokenKeyword: string]: string;
    };
  };
}

const CONTEXT_KNOWLEDGE_GRAPH: ContextualRules = {
  // ─── 1. Daily Casual Communication with Friends & Family (Core Jury Pitch) ──
  daily: {
    // Step 0: Friend/Interviewer says: "Hey! Great to connect with you. How are you doing today?"
    0: {
      HELLO: "Hello! It is so great to see you today. How have you been?",
      HI: "Hey there! Really good to see you.",
      'HOW ARE YOU': "I am doing great, thank you! How are things with you?",
      GOOD: "I am doing really well today, thanks for asking! How about you?",
      HAPPY: "I am feeling wonderful and very happy to connect with you.",
      I: "Hello! It is really a pleasure to meet you.",
      YES: "Yes, I am doing great! So glad we could catch up.",
      THANK: "Thank you so much! It is truly wonderful to see you.",
    },
    // Step 1: Friend asks: "Are you free to catch up or grab lunch together later?"
    1: {
      YES: "Yes, absolutely! I am completely free, let's definitely catch up.",
      NO: "Unfortunately I have some errands today, but let's plan to meet very soon.",
      FOOD: "Yes, I would love to grab lunch! I am actually getting hungry.",
      TIME: "Sure! What time should we meet? Does 1:00 PM work for you?",
      OK: "Sounds great to me! Where would you like to go?",
      PERFECT: "That sounds absolutely perfect! Count me in.",
      WAIT: "Give me just a minute to check my schedule, but yes, that should work!",
      HOUSE: "Would you like to come over to my place, or should we meet outside?",
      CAR: "I can drive over in my car and pick you up if you'd like.",
      HELP: "I'd be glad to help you out with that before we meet.",
    },
    // Step 2: Friend says: "Awesome! Let's meet at the cafe near the circle. See you soon!"
    2: {
      THANK: "Awesome! Thank you so much, see you there soon! Take care.",
      YES: "Perfect, see you at the cafe! Looking forward to it.",
      OK: "Got it! See you there in a bit. Have a safe journey!",
      GOOD: "Sounds great! See you very soon, bye!",
      'I LOVE YOU': "See you soon, my friend! Take care!",
      PERFECT: "Perfect! Looking forward to catching up.",
    },
    defaultTokenMap: {
      HELLO: "Hello, good to see you.",
      'HOW ARE YOU': "How are you doing today?",
      THANK: "Thank you so much.",
      YES: "Yes, that's right.",
      NO: "No, not right now.",
      WAIT: "Please wait a moment.",
      PLEASE: "Please help me with this.",
      HELP: "I need some help.",
      FOOD: "I would like to have some food.",
      WATER: "Could I get some water, please?",
      TIME: "What time is it right now?",
      HOUSE: "I am at home.",
      CAR: "I am traveling in a car.",
      MEETING: "Let's connect in this meeting.",
      DOCTOR: "I need to consult a doctor.",
      'GOOD MORNING': "Good morning! Hope you have a wonderful day.",
      'GOOD NIGHT': "Good night, take care.",
      'I LOVE YOU': "Thank you, appreciate your support!",
      'CALL ME': "Please give me a call whenever you are free.",
      BOOK: "Let's review the book and notes.",
      PERFECT: "That sounds perfect, thank you.",
      HAPPY: "I am feeling very happy today.",
    }
  },

  // ─── 2. Enterprise BPO: Food & E-Commerce Delivery ────────────────────────
  ecommerce: {
    0: {
      HELLO: "Hello! Welcome to Support. Could you please provide your order ID so I can track your delivery?",
      HI: "Hello! Welcome to Support. Could you please share your order number with me?",
      WAIT: "Please give me a moment. May I have your order ID so I can locate your rider?",
      PLEASE: "Please provide your order number so I can check with our dispatch team right away.",
      HELP: "I am happy to help you find your delivery. Could you please give me your order ID?",
      YES: "Yes, I will check that for you right away. What is your order ID?",
      FOOD: "I understand your food delivery is delayed. Please provide your order ID and I will check immediately.",
    },
    1: {
      WAIT: "Thank you for the order ID. Please hold for one moment while I check with the local dispatch hub.",
      YES: "Thank you. I have verified order 48291 — your delivery rider is 5 minutes away and arriving shortly.",
      OK: "Got it. I have pulled up order 48291 — the rider has picked it up and is arriving in approximately 5 minutes.",
      PERFECT: "Perfect, thank you. Your rider is just 5 minutes away and will reach your doorstep very shortly.",
      HELP: "Thank you, I have contacted the delivery partner — they are 5 minutes away from your location.",
      TIME: "I have checked the live GPS — your delivery partner is about 5 minutes away.",
      CAR: "The delivery rider is currently on the way and should reach your address in about 5 minutes.",
    },
    2: {
      THANK: "You are very welcome! Is there anything else I can assist you with today?",
      HELLO: "It was my pleasure to help! Have a wonderful day ahead.",
      YES: "Always happy to help! Please enjoy your meal, and feel free to reach back out if needed.",
      OK: "Glad I could assist you! Thank you for choosing us, have a great day.",
      GOOD: "You are most welcome! Have a fantastic day ahead.",
    },
    defaultTokenMap: {
      HELLO: "Hello! Thank you for contacting customer support. How may I assist you today?",
      WAIT: "Please hold on for just a moment while I look into this for you.",
      THANK: "Thank you for your patience and for contacting us. Have a wonderful day!",
      YES: "Yes, that is confirmed and updated in our system.",
      NO: "I apologize, but that is currently not possible according to our policy.",
      HELP: "I am here to assist you. Please let me know what you need help with.",
      PERFECT: "That sounds perfect, I have recorded the details.",
      FOOD: "Let me check the status of your food order immediately.",
      WATER: "I have made a note regarding your beverage and refreshment request.",
      TIME: "Let me check the estimated arrival time for you right now.",
    }
  },

  // ─── 3. Enterprise BPO: Banking & Card Support ────────────────────────────
  banking: {
    0: {
      HELLO: "Welcome to Card Security Support. Let me verify your account. Please confirm your registered mobile number.",
      WAIT: "Please hold for a moment. Let me verify your account details — could you state your registered mobile number?",
      HELP: "I can help you check your card status right away. Please confirm your registered mobile number.",
      YES: "Yes, let me inspect the decline reason for you. Could you please confirm your registered mobile number?",
      PLEASE: "Please confirm your registered mobile number so I can access your card diagnostics.",
    },
    1: {
      WAIT: "Thank you. A temporary security hold was placed. Please hold while I verify and remove the block.",
      YES: "Thank you. A temporary security hold was placed. I have now verified your identity and unblocked your card.",
      OK: "Thank you. Your account ending in 8840 is verified. I have cleared the security flag and your card is active.",
      PERFECT: "Perfect. Your account ending in 8840 is verified and the card has been successfully unblocked.",
      GOOD: "Great news, your identity has been verified and your debit card is now fully unblocked for all transactions.",
    },
    2: {
      THANK: "You are very welcome! Your card is now active. Thank you for banking with us!",
      HELLO: "Glad I could resolve it for you today! Have a secure and wonderful day.",
      YES: "My pleasure! Please let us know if you need anything else. Have a great day!",
      OK: "Thank you for choosing our banking services. Have a fantastic day ahead!",
    },
    defaultTokenMap: {
      HELLO: "Welcome to Card and Banking Support. How may I assist you today?",
      WAIT: "Please hold while I check our secure banking records for your account.",
      THANK: "Thank you for banking with us. Is there anything else I can help you with?",
      YES: "Yes, that transaction has been verified and authorized.",
      NO: "No, for your security that action cannot be performed over the phone.",
      HELP: "I am here to protect and assist your account. Please provide your verification details.",
      PERFECT: "Everything looks in order. Your account status is normal.",
    }
  },

  // ─── 4. Enterprise BPO: Emergency 112 Response ────────────────────────────
  emergency: {
    0: {
      HELLO: "This is Emergency 112 Dispatch. An ambulance has been dispatched to MG Road circle immediately.",
      WAIT: "Stay calm, help is on the way. How many people are injured at the scene?",
      HELP: "Emergency response has received your distress call. An ambulance is heading to MG Road circle right now.",
      YES: "Understood! An ambulance is on its way to MG Road circle right now. Please tell me if anyone is injured.",
      DOCTOR: "Medical paramedics have been notified and are en route to MG Road circle right now.",
      CAR: "Emergency traffic units and ambulance have been dispatched to the accident site.",
    },
    1: {
      WAIT: "Paramedics are en route with an estimated arrival time of 4 minutes. Please ensure the area is safe.",
      YES: "Understood. The trauma response unit has been updated and is arriving in 4 minutes. Please do not move the injured.",
      OK: "Help is 4 minutes away. Keep them calm, comfortable, and keep the road clear for the incoming ambulance.",
      HELP: "Our paramedics are 4 minutes away. Stay on the line and keep the patients still.",
      TIME: "The ambulance is approximately 4 minutes away from your location.",
      DOCTOR: "Paramedics are 4 minutes away and are prepared to administer immediate first aid.",
    },
    2: {
      THANK: "Our emergency response unit has arrived at your location. The paramedics are with you now.",
      YES: "The sirens should be audible now — the ambulance has reached MG Road circle.",
      OK: "The medical team is on site. Please signal to the paramedics.",
      GOOD: "The ambulance has reached your location. Please stay safe.",
    },
    defaultTokenMap: {
      HELLO: "Emergency Services Helpline. Please state your exact emergency location.",
      WAIT: "Please stay on the line, our emergency coordinators are processing your request.",
      HELP: "Emergency assistance is actively being coordinated for your location.",
      YES: "Affirmative, the nearest emergency unit has been dispatched.",
      NO: "Negative, please do not take any risky actions until emergency responders arrive.",
      DOCTOR: "Medical support and paramedics are being routed immediately.",
      TIME: "Help is estimated to reach your location within minutes.",
    }
  }
};

/**
 * Forms a contextually accurate, fluent spoken sentence
 * from one or more ISL gesture tokens and the current call context.
 */
export function composeContextualSentence(
  tokens: string[],
  scenarioId: string = 'daily',
  dialogueStep: number = 0,
  lastCallerMessage: string = '',
  isRealCall: boolean = false
): ComposedSentenceResult {
  if (!tokens || tokens.length === 0) {
    return {
      sentence: '',
      source: 'direct',
      intent: 'empty',
      confidence: 0,
    };
  }

  const upperTokens = tokens.map((t) => t.toUpperCase().trim());
  const joinedTokens = upperTokens.join(' ');
  const primaryToken = upperTokens[upperTokens.length - 1];
  const callerLower = (lastCallerMessage || '').toLowerCase();
  const isGreetingQuestion = callerLower.includes('how are you') || callerLower.includes('how about you') || callerLower.includes('doing');

  // 1. Check for Fingerspelled Words (SPELL:<word>)
  const spelledToken = upperTokens.find((t) => t.startsWith('SPELL:'));
  if (spelledToken) {
    const rawWord = spelledToken.replace('SPELL:', '').trim();
    const cleanWord = rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();

    // If preceded by I or MY (e.g. [MY, SPELL:RAHUL])
    if (joinedTokens.includes('I') || joinedTokens.includes('MY')) {
      return {
        sentence: `Hello! My name is ${cleanWord}. It is very nice to meet you!`,
        source: 'contextual-template',
        intent: 'SELF_INTRO',
        confidence: 0.99,
      };
    }

    // If question was "What is your name?"
    if (lastCallerMessage.toLowerCase().includes('name') || lastCallerMessage.toLowerCase().includes('who are you')) {
      return {
        sentence: `My name is ${cleanWord}. Nice to connect with you!`,
        source: 'contextual-template',
        intent: 'NAME_REPLY',
        confidence: 0.99,
      };
    }

    return {
      sentence: `I am spelling ${cleanWord}.`,
      source: 'contextual-template',
      intent: 'SPELLED_WORD',
      confidence: 0.95,
    };
  }

  // 1b. Direct Contextual Question Answering for YES / NO
  if (primaryToken === 'YES' || primaryToken === 'NO') {
    const isYes = primaryToken === 'YES';
    if (callerLower.includes('lunch') || callerLower.includes('dinner') || callerLower.includes('breakfast') || callerLower.includes('food') || callerLower.includes('eat')) {
      return {
        sentence: isYes ? "Yes, I had my food." : "No, not yet.",
        source: 'contextual-template',
        intent: isYes ? 'YES_FOOD' : 'NO_FOOD',
        confidence: 0.99,
      };
    }
    if (callerLower.includes('medicine') || callerLower.includes('tablet') || callerLower.includes('dose') || callerLower.includes('prescription')) {
      return {
        sentence: isYes ? "Yes, I have taken my medicine." : "No, I haven't taken it yet.",
        source: 'contextual-template',
        intent: isYes ? 'YES_MEDICINE' : 'NO_MEDICINE',
        confidence: 0.99,
      };
    }
    if (callerLower.includes('doctor') || callerLower.includes('hospital') || callerLower.includes('clinic')) {
      return {
        sentence: isYes ? "Yes, I will consult the doctor." : "No, not right now.",
        source: 'contextual-template',
        intent: isYes ? 'YES_DOCTOR' : 'NO_DOCTOR',
        confidence: 0.99,
      };
    }
    if (callerLower.includes('ready') || callerLower.includes('start')) {
      return {
        sentence: isYes ? "Yes, I am ready." : "No, give me a moment.",
        source: 'contextual-template',
        intent: isYes ? 'YES_READY' : 'NO_READY',
        confidence: 0.99,
      };
    }
    if (isGreetingQuestion) {
      return {
        sentence: isYes ? "Yes, I am doing well, thank you." : "I am feeling a bit tired today.",
        source: 'contextual-template',
        intent: isYes ? 'YES_GREETING' : 'NO_GREETING',
        confidence: 0.99,
      };
    }
    return {
      sentence: isYes ? "Yes, that's right." : "No, not right now.",
      source: 'contextual-template',
      intent: isYes ? 'YES' : 'NO',
      confidence: 0.95,
    };
  }

  // 2. High-Priority Semantic Sign Matching on the Latest Gesture (Primary Token)
  // Ensures user's latest sign is never overridden by earlier lingering tokens
  if (primaryToken === 'PERFECT') {
    if (isGreetingQuestion) {
      return {
        sentence: "I am doing great and everything is wonderful today, thank you for asking!",
        source: 'contextual-template',
        intent: 'PERFECT_GREETING',
        confidence: 0.99,
      };
    }
    return {
      sentence: "That is absolutely perfect, thank you so much!",
      source: 'contextual-template',
      intent: 'PERFECT',
      confidence: 0.99,
    };
  }

  if (primaryToken === 'WAIT') {
    return {
      sentence: "Please wait for just a moment, I will be right back with you.",
      source: 'contextual-template',
      intent: 'WAIT',
      confidence: 0.99,
    };
  }

  if (primaryToken === 'HELLO' || primaryToken === 'HI') {
    if (isGreetingQuestion) {
      return {
        sentence: "Hello! Good to see you. I am doing great today, how about you?",
        source: 'contextual-template',
        intent: 'HELLO_GREETING',
        confidence: 0.99,
      };
    }
    return {
      sentence: "Hello! Good to see you. How are you doing today?",
      source: 'contextual-template',
      intent: 'HELLO',
      confidence: 0.99,
    };
  }

  if (primaryToken === 'PLEASE') {
    return {
      sentence: "Could you please help me with that whenever you have time?",
      source: 'contextual-template',
      intent: 'PLEASE',
      confidence: 0.98,
    };
  }

  if (primaryToken === 'THANK') {
    return {
      sentence: "Thank you so much! I really appreciate your support.",
      source: 'contextual-template',
      intent: 'THANK',
      confidence: 0.99,
    };
  }

  // 3. Intelligent Multi-Sign Combinations (Sign-Driven Syntax)
  if (joinedTokens.includes('HELLO') && (joinedTokens.includes('HOW') || joinedTokens.includes('YOU'))) {
    return {
      sentence: "Hello! How are you doing today? Great to see you!",
      source: 'contextual-template',
      intent: 'GREETING_ENQUIRY',
      confidence: 0.99,
    };
  }

  if (joinedTokens.includes('FOOD') && joinedTokens.includes('TIME')) {
    return {
      sentence: "Is it time for food now? Let's go have something to eat!",
      source: 'contextual-template',
      intent: 'FOOD_TIME',
      confidence: 0.98,
    };
  }

  if (joinedTokens.includes('PLEASE') && joinedTokens.includes('WAIT')) {
    return {
      sentence: "Please wait for just a moment, I will be right back with you.",
      source: 'contextual-template',
      intent: 'PLEASE_WAIT',
      confidence: 0.98,
    };
  }

  if (joinedTokens.includes('YES') && joinedTokens.includes('THANK')) {
    return {
      sentence: "Yes, absolutely! Thank you so much for your help.",
      source: 'contextual-template',
      intent: 'YES_THANK',
      confidence: 0.98,
    };
  }

  if (joinedTokens.includes('CAR') && (joinedTokens.includes('HOUSE') || joinedTokens.includes('HOME'))) {
    return {
      sentence: "I am driving in the car and on my way home now.",
      source: 'contextual-template',
      intent: 'DRIVE_HOME',
      confidence: 0.98,
    };
  }

  if (joinedTokens.includes('HELP') && (joinedTokens.includes('DOCTOR') || joinedTokens.includes('MEDICINE'))) {
    return {
      sentence: "I need medical help and would like to see a doctor today.",
      source: 'contextual-template',
      intent: 'MEDICAL_HELP',
      confidence: 0.98,
    };
  }

  // 4. Prioritize Most Recent Confirmed Token (from right to left)
  const isRealPhoneCall = isRealCall || Boolean(lastCallerMessage && lastCallerMessage.trim().length > 0);
  const domain = CONTEXT_KNOWLEDGE_GRAPH[scenarioId] || CONTEXT_KNOWLEDGE_GRAPH['daily'];

  // Only apply scripted scenario steps if this is an explicitly simulated demo with NO real caller
  if (!isRealPhoneCall && domain[dialogueStep]) {
    const stepRules = domain[dialogueStep];
    // Check primary (most recent) token first for exact match
    for (const [key, sentence] of Object.entries(stepRules)) {
      if (primaryToken === key) {
        return {
          sentence,
          source: 'contextual-template',
          intent: key,
          confidence: 0.99,
        };
      }
    }
    // Then check full tokens in reverse order
    for (let i = upperTokens.length - 1; i >= 0; i--) {
      const tok = upperTokens[i];
      if (stepRules[tok]) {
        return {
          sentence: stepRules[tok],
          source: 'contextual-template',
          intent: tok,
          confidence: 0.95,
        };
      }
    }
  }

  // 5. Semantic Gestures Dictionary (Exact matches prioritized)
  // Check exact match for primary (most recent) token first
  for (const [key, sentence] of Object.entries(domain.defaultTokenMap)) {
    if (primaryToken === key) {
      return {
        sentence,
        source: 'contextual-template',
        intent: key,
        confidence: 0.98,
      };
    }
  }

  // Then check other tokens in reverse chronological order
  for (let i = upperTokens.length - 1; i >= 0; i--) {
    const tok = upperTokens[i];
    for (const [key, sentence] of Object.entries(domain.defaultTokenMap)) {
      if (tok === key) {
        return {
          sentence,
          source: 'contextual-template',
          intent: key,
          confidence: 0.95,
        };
      }
    }
  }

  // Fallback substring search (avoiding 'GOOD' matching 'GOOD NIGHT')
  for (const [key, sentence] of Object.entries(domain.defaultTokenMap)) {
    if (key.length > 3 && primaryToken.includes(key)) {
      return {
        sentence,
        source: 'contextual-template',
        intent: key,
        confidence: 0.90,
      };
    }
  }

  // 6. Universal Natural Verbalization
  const cleanTokens = tokens.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean).join(' ');
  return {
    sentence: cleanTokens ? cleanTokens.charAt(0).toUpperCase() + cleanTokens.slice(1) + '.' : '',
    source: 'direct',
    intent: 'GENERIC',
    confidence: 0.85,
  };
}
