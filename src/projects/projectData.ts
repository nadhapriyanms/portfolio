export type ProjectModelKey =
  | 'tractor'
  | 'crawler'
  | 'probe'
  | 'eeg'
  | 'doorbell'
  | 'assistant'
  | 'scanner'
  | 'lora'
  | 'lock'

export interface Project {
  id: string
  title: string
  short: string
  category: string
  summary: string
  problem?: string
  approach?: string[]
  technologies: string[]
  outcome?: string
  status: string
  achievements?: string[]
  /** Where every statement on this card comes from. */
  source: string
  model: ProjectModelKey
  accent: string
  links?: { label: string; href: string }[]
}

// Content rule: only what the resume or a supplied project document states. Unknown fields are omitted.
export const projects: Project[] = [
  {
    id: 'driverless-tractor',
    title: 'AI-Driven Driverless Tractor',
    short: 'Driverless Tractor',
    category: 'E-Vehicle · Robotics',
    summary:
      'A driverless agricultural tractor that uses AI algorithms, proximity sensors and GPS guidance to navigate farmland on its own.',
    problem: 'Automating traditional farming practices that rely on a human driver for every pass across the field.',
    approach: [
      'GPS guidance for autonomous navigation across farmland.',
      'Proximity sensors for real-time obstacle detection.',
      'AI algorithms supporting precision-farming decisions.',
    ],
    technologies: ['AI algorithms', 'Proximity sensors', 'GPS guidance', 'Obstacle detection'],
    status: 'Project build',
    source: 'Resume — Projects',
    model: 'tractor',
    accent: '#9be36b',
  },
  {
    id: 'crawler-bot',
    title: 'Perseverance-Inspired Crawling Robot',
    short: 'Crawling Robot',
    category: 'Robotics · Hardware',
    summary:
      'A crawling robot inspired by the Perseverance rover, also built as a fire-extinguisher bot.',
    technologies: ['Robotics', 'Embedded hardware'],
    status: 'Project build',
    source: 'Resume — Projects (title only; no further specifications supplied)',
    model: 'crawler',
    accent: '#ff8a4c',
  },
  {
    id: 'hupss',
    title: 'HUPSS — Hanging Underwater Probes for Ships',
    short: 'HUPSS',
    category: 'Research · Embedded Systems',
    summary:
      'Underwater research probes that hang from ships to monitor marine conditions for academic and ecological studies.',
    problem: 'Gathering continuous data on water quality and marine conditions directly from a moving vessel.',
    approach: [
      'Ship-mounted probes lowered into the water column.',
      'Waterproofed sensor housings.',
      'Data logging for real-time aquatic research.',
      'Project deck lists temperature, salinity and pH among the measured parameters.',
    ],
    technologies: ['Waterproof sensor housings', 'Data logging', 'Marine sensing'],
    outcome: 'Runner-up, IDEX Defence Innovation Challenge — underwater naval research category.',
    status: 'Recognised concept',
    achievements: ['Runner-up — IDEX Defence Innovation Challenge'],
    source: 'Resume — Projects & Achievements; HUPSS project deck',
    model: 'probe',
    accent: '#ffd23f',
  },
  {
    id: 'neurobridge',
    title: 'NeuroBridge — EEG Brain-Computer Interface',
    short: 'NeuroBridge',
    category: 'Research · Biomedical',
    summary:
      'A non-invasive brain-computer interface that translates EEG signals into control commands, aimed at helping people with motor impairments communicate.',
    approach: [
      'EEG headset for non-invasive signal capture.',
      'Python and machine-learning models for signal classification.',
      'A control interface driven by the classified signals.',
    ],
    technologies: ['EEG headset', 'Python', 'Machine learning'],
    status: 'Research in progress — not clinically validated',
    source: 'Resume — Projects (marked "On Research")',
    model: 'eeg',
    accent: '#c58bff',
  },
  {
    id: 'smart-doorbell',
    title: 'IoT Smart Doorbell with Facial Recognition',
    short: 'Smart Doorbell',
    category: 'IoT · Smart Systems',
    summary:
      'A smart doorbell that recognises faces in real time, logs visitors and lets the owner manage access from a mobile app.',
    problem:
      'Traditional doorbells offer no way to identify visitors or monitor the door remotely.',
    approach: [
      'ESP32 / ESP32-CAM captures images and runs facial recognition with OpenCV.',
      'Cloud storage keeps a visitor log; notifications reach a mobile app.',
      'Design notes add a PIR motion trigger, infrared LEDs for night images and a relay-driven chime.',
    ],
    technologies: ['ESP32', 'ESP32-CAM', 'OpenCV', 'Cloud storage', 'Mobile app', 'PIR sensor'],
    status: 'Prototype in progress',
    source: 'Resume — Projects; Smart Doorbell design document',
    model: 'doorbell',
    accent: '#5ee1ff',
  },
  {
    id: 'legal-kyc',
    title: 'Digital Assistant for Legal Awareness & KYC Framework',
    short: 'Legal & KYC Assistant',
    category: 'Software',
    summary:
      'An app that gives legal guidance and walks users through Know-Your-Customer documentation.',
    problem:
      'Smart India Hackathon problem statement 1283 (Ministry of Law and Justice): a digital assistant for legal awareness and a KYC framework for India.',
    approach: [
      'NLP-based prototype that answers legal queries and cites the laws involved.',
      'Guided "Know Your Rights" flow and KYC steps (identification, due diligence, ongoing monitoring).',
      'Built with Python and Flask with integrated APIs for legal updates; UI designed in Figma.',
    ],
    technologies: ['Python', 'Flask', 'APIs', 'NLP', 'Figma'],
    outcome: 'Finalist — Smart India Hackathon 2023 (software category). Led the six-member team "Tech Fellas".',
    status: 'Hackathon prototype',
    achievements: ['Finalist — Smart India Hackathon 2023'],
    source: 'Resume — Projects & Achievements; SIH 2023 idea deck',
    model: 'assistant',
    accent: '#7cf2c9',
  },
  {
    id: 'vuln-assessment',
    title: 'Vulnerability Assessment of Institutional Web Portals',
    short: 'Vulnerability Assessment',
    category: 'Cybersecurity',
    summary:
      'A security audit of academic web systems using Nessus, with remediation priorities set by CVSS scoring.',
    approach: [
      'Scanned and evaluated academic web systems with Nessus.',
      'Reported the vulnerabilities found.',
      'Recommended remediation by CVSS score and risk impact.',
    ],
    technologies: ['Nessus', 'CVSS', 'Risk analysis', 'Reporting'],
    status: 'Completed assessment — target details withheld',
    source: 'Resume — Projects',
    model: 'scanner',
    accent: '#ff3caa',
  },
  {
    id: 'spark-accident',
    title: 'Intelligent Invisible Guarding System — LoRa Accident Detection',
    short: 'LoRa Accident Detection',
    category: 'IoT · Embedded (team SPARK)',
    summary:
      'An accident-detection unit that senses a crash and sends its GPS location over LoRa, so the alert does not depend on cellular coverage.',
    problem:
      'Existing accident alerts rely on cellular networks and human intervention, and single-sensor systems raise false alarms.',
    approach: [
      'ESP32 fuses an MPU6050 IMU and a vibration sensor against threshold values.',
      'A NEO-6M GPS module fixes the location of the vehicle.',
      'A LoRa SX1278 (433 MHz) link carries the alert to a receiver with an OLED display and buzzer.',
      'Firmware simulated in Wokwi before being built on perfboard.',
    ],
    technologies: ['ESP32', 'LoRa SX1278', 'MPU6050', 'NEO-6M GPS', 'OLED', 'Wokwi'],
    status: 'Working hardware prototype (academic project, 3-member team)',
    source: 'SPARK project deck & poster (not listed on the resume)',
    model: 'lora',
    accent: '#ffb547',
  },
  {
    id: 'password-analyzer',
    title: 'Password Strength Analyzer',
    short: 'Password Analyzer',
    category: 'Cybersecurity · Internship project',
    summary:
      'A scoring-based password strength analyzer, benchmarked against public strength checkers, with guidance on building stronger passwords.',
    approach: [
      'Scored passwords on length, character variety, unpredictability and uniqueness.',
      'Tested a varied password set and benchmarked results against online analyzers.',
      'Covered brute-force, dictionary and credential-stuffing attacks in the findings.',
    ],
    technologies: ['Strength scoring', 'Benchmarking', 'Security awareness'],
    status: 'Internship project',
    source: 'Password Strength Analyzer internship deck (not listed on the resume)',
    model: 'lock',
    accent: '#2de2e6',
  },
]

export const projectById = (id: string) => projects.find((p) => p.id === id)
