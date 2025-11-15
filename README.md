# 🧠 Foc.Us
Take back your focus. Live more.
🚀 Overview
Foc.Us is a minimalist mobile app that helps students and professionals reclaim focus time, reduce digital distractions, and improve study-life balance.
It combines focus sessions, motivation mechanics, and an adaptive engine that personalizes session lengths based on your behavior — helping you build lasting concentration habits.
This MVP was built with React Native (Expo) as a prototype for university pilots.
✨ Features
Category	Description
🎯 Focus Timer	Start distraction-free study sessions (Pomodoro-style) with adjustable duration.
📊 Dashboard	Track today’s and weekly focused minutes, streaks, and total points.
🧩 Gamified Motivation	Earn points per minute and bonuses for completing full sessions.
🔁 Adaptive Engine	Automatically suggests shorter sessions when you get interrupted often.
🚫 Interruptions Tracking	Mark “I got distracted” to track and learn from focus breaks.
🏆 Goal Progress	See your daily focus goal progress and streaks visually.
💾 Local Data Storage	No account needed — everything is saved on your device.
📤 Export Sessions	Download your focus history as a .json file for research or reporting.
🧘 Quick Test Mode	For demo or testing: run 1-minute sessions to preview functionality.
🧱 Tech Stack
Layer	Technology
Frontend	React Native (Expo SDK 51+)
Storage	AsyncStorage / localStorage fallback
Platform	iOS, Android, Web (via Expo)
Style	React Native StyleSheet (minimalist UI)
📲 How to Run (Expo)
Option 1 – Run in Browser (Expo Snack)
Open https://snack.expo.dev
Create a new project and replace the code in App.js with the MVP code.
Upload your logo.png to the /assets folder.
Click Run on Web or scan the QR code with the Expo Go app.
Option 2 – Run Locally
npm install -g expo-cli
git clone https://github.com/YOUR_USERNAME/focus-app.git
cd focus-app
npm install
expo start
Then:
Press w to open in web
Or scan the QR code from Expo Go
🧩 Project Structure
foc.us/
├── App.js
├── package.json
├── assets/
│   └── logo.png
└── README.md
🧠 Adaptive Focus Engine (Logic)
Foc.Us monitors user interruptions and automatically adjusts session lengths to make focus habits more sustainable.
Algorithm:
if (interruptRate >= 40% in last 7 sessions)
    suggest new session length = currentLength - 5 minutes
Users can accept or dismiss the suggestion — learning to focus gradually and naturally.
🎓 For Universities
Foc.Us is designed for academic pilots studying:
Student focus and attention habits
Effects of gamification on learning outcomes
Tech-assisted productivity and mental wellness
Universities receive:
Anonymized session data exports (JSON/CSV)
Focus habit reports for groups or cohorts
Option for custom dashboards and analysis
💡 Future Roadmap
 Integrate optional cloud sync (Firebase or Supabase)
 Add background notifications
 Introduce group challenges (“Study Rooms”)
 Offer premium analytics for institutions
 Publish on Play Store & App Store
📄 License
This project is released for educational and pilot purposes under a limited-use prototype license.
For collaborations or licensing inquiries, contact the author.
🧑‍💻 Author
Augusto Todeschini
Creator of Foc.Us — built for focus, not friction.
📧 contact: [your-email-here]
🌐 [optional: add your landing page once we make it]
