// App.js - paste into Expo Snack
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";

/* ------------------- Simple storage helper (AsyncStorage fallback) ------------------- */
const STORAGE = {
  async get(key, fallback = null) {
    try {
      if (typeof localStorage !== "undefined") {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : fallback;
      }
    } catch (e) {
      console.warn("storage.get error", e);
    }
    return fallback;
  },
  async set(key, value) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn("storage.set error", e);
    }
  },
  async remove(key) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn("storage.remove error", e);
    }
  },
};

/* ------------------- Helpers ------------------- */
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}
function todayDateString() {
  return new Date().toDateString();
}
function minutesFromSeconds(s) {
  return Math.round(s / 60);
}

/* ------------------- Defaults ------------------- */
const PRESET_MINUTES = [15, 20, 25, 30];
const DEFAULT_SESSION_MIN = 25;
const QUICK_TEST_MIN = 1;

/* ------------------- App ------------------- */
export default function App() {
  // Onboarding
  const [name, setName] = useState("");
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60);
  const [onboardDone, setOnboardDone] = useState(false);
  // Timer & session
  const [sessionSeconds, setSessionSeconds] = useState(DEFAULT_SESSION_MIN * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  // Data
  const [sessions, setSessions] = useState([]);
  const [user, setUser] = useState({ points: 0, streak: 0, lastSessionDay: null, sessionLengthMin: DEFAULT_SESSION_MIN });
  // UI states
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_SESSION_MIN);
  const [quickTestMode, setQuickTestMode] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // adaptive engine suggestion

  /* ------------------- Load stored data ------------------- */
  useEffect(() => {
    (async () => {
      const savedUser = await STORAGE.get("focuss_user", null);
      const savedSessions = await STORAGE.get("focuss_sessions", []);
      if (savedUser) {
        setUser(savedUser);
        setName(savedUser.name || "");
        setDailyGoalMinutes(savedUser.dailyGoalMinutes || 60);
        setOnboardDone(!!savedUser.onboardDone);
        const len = savedUser.sessionLengthMin || DEFAULT_SESSION_MIN;
        setSelectedPreset(len);
        setSessionSeconds(len * 60);
      }
      if (savedSessions) setSessions(savedSessions);
    })();
  }, []);

  /* ------------------- Persist data ------------------- */
  useEffect(() => {
    STORAGE.set("focuss_user", { ...user, name, dailyGoalMinutes, onboardDone });
  }, [user, name, dailyGoalMinutes, onboardDone]);

  useEffect(() => {
    STORAGE.set("focuss_sessions", sessions);
  }, [sessions]);

  /* ------------------- Timer logic (stable) ------------------- */
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSessionSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  function startSession() {
    const lenMin = quickTestMode ? QUICK_TEST_MIN : (user.sessionLengthMin || selectedPreset);
    setSessionSeconds(lenMin * 60);
    setIsRunning(true);
    sessionStartRef.current = Date.now();
  }
  function pauseSession() {
    setIsRunning(false);
  }
  function resetSession() {
    setIsRunning(false);
    const lenMin = quickTestMode ? QUICK_TEST_MIN : (user.sessionLengthMin || selectedPreset);
    setSessionSeconds(lenMin * 60);
  }

  /* ------------------- Complete & interrupted handlers ------------------- */
  async function handleComplete() {
    setIsRunning(false);
    const endAt = Date.now();
    const startAt = sessionStartRef.current || (endAt - (user.sessionLengthMin || selectedPreset) * 60 * 1000);
    const focusedSeconds = Math.round((endAt - startAt) / 1000);
    const focusedMinutes = Math.max(1, Math.round(focusedSeconds / 60));
    const newSession = {
      id: Date.now(),
      startAt,
      endAt,
      focusedMinutes,
      interrupted: false,
    };
    const newSessions = [...sessions, newSession];
    setSessions(newSessions);

    // points & streak logic
    let pts = (user.points || 0) + focusedMinutes + 10; // per minute + completion bonus
    const lastDay = user.lastSessionDay || null;
    const today = todayDateString();
    let streak = user.streak || 0;
    if (lastDay === today) {
      // already had session today
    } else {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      streak = lastDay === yesterday ? streak + 1 : 1;
    }
    const newUser = { ...user, points: pts, streak, lastSessionDay: today, sessionLengthMin: user.sessionLengthMin || selectedPreset };
    setUser(newUser);
    Alert.alert("Session complete!", `You earned ${focusedMinutes + 10} pts. Streak: ${streak} day(s).`);
    sessionStartRef.current = null;
    evaluateAdaptive(newSessions); // run adaptive engine after session
  }

  async function markInterrupted() {
    // mark current session interrupted and save partial time
    setIsRunning(false);
    const endAt = Date.now();
    const startAt = sessionStartRef.current || (endAt - (user.sessionLengthMin || selectedPreset) * 60 * 1000);
    const focusedSeconds = Math.round((endAt - startAt) / 1000);
    const focusedMinutes = Math.max(0, Math.round(focusedSeconds / 60));
    const newSession = {
      id: Date.now(),
      startAt,
      endAt,
      focusedMinutes,
      interrupted: true,
    };
    const newSessions = [...sessions, newSession];
    setSessions(newSessions);

    // smaller reward for interrupted session
    let pts = (user.points || 0) + focusedMinutes;
    // do not advance streak if interrupted
    const newUser = { ...user, points: pts };
    setUser(newUser);
    Alert.alert("Session interrupted", `You still got ${focusedMinutes} min. Keep going!`);
    sessionStartRef.current = null;
    evaluateAdaptive(newSessions);
  }

  /* ------------------- Stats & computed ------------------- */
  const today = todayDateString();
  const weekAgoTs = Date.now() - 7 * 24 * 3600 * 1000;
  const todayMinutes = sessions.filter((s) => new Date(s.endAt).toDateString() === today).reduce((a, b) => a + (b.focusedMinutes || 0), 0);
  const weekMinutes = sessions.filter((s) => s.endAt >= weekAgoTs).reduce((a, b) => a + (b.focusedMinutes || 0), 0);
  const interruptedCount7 = sessions.filter((s) => s.endAt >= weekAgoTs && s.interrupted).length;
  const totalCount7 = sessions.filter((s) => s.endAt >= weekAgoTs).length;
  const interruptionRate = totalCount7 > 0 ? interruptedCount7 / totalCount7 : 0;

  /* ------------------- Adaptive engine (simple rules) ------------------- */
  function evaluateAdaptive(currentSessions) {
    const lastN = 7;
    const lastSessions = currentSessions.slice(-lastN);
    const interrupts = lastSessions.filter((s) => s.interrupted).length;
    const rate = lastSessions.length > 0 ? interrupts / lastSessions.length : 0;
    // Suggest reduce session if interrupt rate high
    if (rate >= 0.4 && lastSessions.length >= 3) {
      const suggested = Math.max(10, (user.sessionLengthMin || selectedPreset) - 5);
      setSuggestion({
        reason: `High interrupt rate (${Math.round(rate * 100)}%) in last ${lastSessions.length} sessions`,
        suggestedMinutes: suggested,
      });
    } else {
      setSuggestion(null);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    const newUser = { ...user, sessionLengthMin: suggestion.suggestedMinutes };
    setUser(newUser);
    setSelectedPreset(suggestion.suggestedMinutes);
    setSessionSeconds(suggestion.suggestedMinutes * 60);
    setSuggestion(null);
    Alert.alert("Suggestion applied", `Session length set to ${suggestion.suggestedMinutes} min.`);
  }

  /* ------------------- Export & reset ------------------- */
  function exportJSON() {
    const dataStr = JSON.stringify({ sessions, user, exportedAt: Date.now() }, null, 2);
    if (typeof document !== "undefined") {
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "focuss_sessions.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert("Export not available");
    }
  }

  async function resetAll() {
    await STORAGE.remove("focuss_sessions");
    await STORAGE.remove("focuss_user");
    setSessions([]);
    setUser({ points: 0, streak: 0, lastSessionDay: null, sessionLengthMin: DEFAULT_SESSION_MIN });
    setName("");
    setOnboardDone(false);
    setSelectedPreset(DEFAULT_SESSION_MIN);
    setSessionSeconds(DEFAULT_SESSION_MIN * 60);
    Alert.alert("Reset", "Local data cleared.");
  }

  /* ------------------- UI ------------------- */
  if (!onboardDone) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={require("./assets/logo.png")} style={styles.logoLarge} />
        <Text style={styles.title}>Welcome to Foc.Us</Text>
        <Text style={styles.subtitle}>Take back your focus. Live more.</Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g., Joaquim" style={styles.input} />

        <Text style={styles.label}>Daily focus goal (minutes)</Text>
        <TextInput keyboardType="numeric" value={String(dailyGoalMinutes)} onChangeText={(t) => setDailyGoalMinutes(Number(t) || 0)} style={styles.input} />

        <Text style={[styles.label, { marginTop: 12 }]}>Default session length (minutes)</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          {PRESET_MINUTES.map((p) => (
            <TouchableOpacity key={p} onPress={() => { setSelectedPreset(p); setSessionSeconds(p * 60); }} style={[styles.presetBtn, selectedPreset === p && styles.presetBtnActive]}>
              <Text style={[styles.presetText, selectedPreset === p && { color: "#fff" }]}>{p}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => { setOnboardDone(true); STORAGE.set("focuss_user", { name, dailyGoalMinutes, points: user.points || 0, streak: user.streak || 0, onsite: true, sessionLengthMin: selectedPreset, onboardDone: true }); }} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Start using Foc.Us</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setQuickTestMode(true); setSessionSeconds(QUICK_TEST_MIN * 60); }} style={[styles.secondaryBtn, { marginTop: 12 }]}>
          <Text style={styles.secondaryBtnText}>Quick test mode (1 min sessions)</Text>
        </TouchableOpacity>

        <Text style={styles.smallText}>Data is saved locally on your device/browser. No servers by default.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.appContainer}>
      <View style={styles.header}>
        <Image source={require("logo.png")} style={styles.logoSmall} />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.appTitle}>Foc.Us</Text>
          <Text style={styles.appTag}>Focus + time back</Text>
        </View>
      </View>

      {/* Focus session card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Focus Session</Text>
        <Text style={styles.timerText}>{formatTime(sessionSeconds)}</Text>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 10 }}>
          <TouchableOpacity onPress={() => setIsRunning(!isRunning)} style={[styles.controlBtn, { backgroundColor: isRunning ? "#F59E0B" : "#2563EB" }]}>
            <Text style={styles.controlBtnText}>{isRunning ? "Pause" : "Start"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={resetSession} style={[styles.controlBtn, { backgroundColor: "#94A3B8" }]}>
            <Text style={styles.controlBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 10 }}>
          <TouchableOpacity onPress={markInterrupted} style={[styles.secondarySmallBtn]}>
            <Text style={styles.secondarySmallBtnText}>I got distracted</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setQuickTestMode(!quickTestMode); Alert.alert("Quick test", quickTestMode ? "Off" : "On"); }} style={[styles.secondarySmallBtn]}>
            <Text style={styles.secondarySmallBtnText}>{quickTestMode ? "Test: ON" : "Quick test"}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 12, alignItems: "center" }}>
          <Text style={styles.smallText}>Session length: {user.sessionLengthMin || selectedPreset} min</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {PRESET_MINUTES.map((p) => (
              <TouchableOpacity key={p} onPress={() => { setSelectedPreset(p); setUser({ ...user, sessionLengthMin: p }); setSessionSeconds(p * 60); }} style={[styles.presetBtnSmall, (user.sessionLengthMin || selectedPreset) === p && styles.presetBtnActiveSmall]}>
                <Text style={[(user.sessionLengthMin || selectedPreset) === p ? { color: "#fff" } : { color: "#0f172a" }]}>{p}m</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Dashboard */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dashboard</Text>
        <Text>Today focused: <Text style={{ fontWeight: "700" }}>{todayMinutes} min</Text></Text>
        <Text>Last 7 days: <Text style={{ fontWeight: "700" }}>{weekMinutes} min</Text></Text>
        <Text>Points: <Text style={{ fontWeight: "700" }}>{user.points}</Text></Text>
        <Text>Streak: <Text style={{ fontWeight: "700" }}>{user.streak} day(s)</Text></Text>

        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: "#475569" }}>Daily goal progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((todayMinutes / (dailyGoalMinutes || 1)) * 100))}%` }]} />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: "#475569" }}>Interruptions (last 7 days): {totalCount7} sessions, {interruptedCount7} interrupted</Text>
        </View>
      </View>

      {/* Adaptive suggestion */}
      {suggestion && (
        <View style={[styles.card, { borderColor: "#F59E0B", borderWidth: 1 }]}>
          <Text style={styles.cardTitle}>Suggestion</Text>
          <Text style={{ marginBottom: 8 }}>{suggestion.reason}</Text>
          <Text style={{ marginBottom: 8 }}>We suggest shorter sessions: {suggestion.suggestedMinutes} min</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={applySuggestion} style={styles.primaryBtnSmall}>
              <Text style={styles.primaryBtnTextSmall}>Apply suggestion</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSuggestion(null)} style={styles.secondaryBtnSmall}>
              <Text style={styles.secondaryBtnTextSmall}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>
        <TouchableOpacity onPress={exportJSON} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Export sessions (JSON)</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={resetAll} style={[styles.secondaryBtn, { marginTop: 8 }]}>
          <Text style={styles.secondaryBtnText}>Reset local data</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* ------------------- Styles ------------------- */
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F6FBF8" },
  appContainer: { flexGrow: 1, padding: 16, backgroundColor: "#F6FBF8" },
  logoLarge: { width: 140, height: 140, marginBottom: 12 },
  logoSmall: { width: 56, height: 56, borderRadius: 12 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtitle: { color: "#334155", marginBottom: 12 },
  label: { alignSelf: "flex-start", marginLeft: 6, marginTop: 8 },
  input: { width: "100%", padding: 12, backgroundColor: "#fff", borderRadius: 10, marginTop: 6 },
  primaryBtn: { backgroundColor: "#059669", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  secondaryBtn: { backgroundColor: "#E6F6EE", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  secondaryBtnText: { color: "#065F46", fontWeight: "700", textAlign: "center" },
  smallText: { fontSize: 12, color: "#64748B", marginTop: 12, textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  appTitle: { fontSize: 20, fontWeight: "700" },
  appTag: { color: "#475569" },

  card: { backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 12 },
  cardTitle: { fontWeight: "700", marginBottom: 8 },

  timerText: { fontSize: 48, textAlign: "center", color: "#2563EB", marginTop: 6 },
  controlBtn: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12 },
  controlBtnText: { color: "#fff", fontWeight: "700" },
  secondarySmallBtn: { backgroundColor: "#E6F0FF", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  secondarySmallBtnText: { color: "#1E3A8A", fontWeight: "700" },

  presetBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#fff", borderColor: "#E2E8F0", borderWidth: 1, marginRight: 4 },
  presetBtnActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  presetText: { color: "#0f172a", fontWeight: "700" },

  presetBtnSmall: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#fff", borderColor: "#E2E8F0", borderWidth: 1 },
  presetBtnActiveSmall: { backgroundColor: "#2563EB", borderColor: "#2563EB" },

  progressBar: { height: 10, backgroundColor: "#E6EEF7", borderRadius: 8, marginTop: 6, overflow: "hidden" },
  progressFill: { height: 10, backgroundColor: "#059669" },

  primaryBtnSmall: { backgroundColor: "#059669", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  primaryBtnTextSmall: { color: "#fff", fontWeight: "700" },
  secondaryBtnSmall: { backgroundColor: "#E6F6EE", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  secondaryBtnTextSmall: { color: "#065F46", fontWeight: "700" },
});
