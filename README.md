# LifeFlow

![Expo](https://img.shields.io/badge/Expo-React%20Native-black)
![Platform](https://img.shields.io/badge/platform-Android-blue)

A minimalist productivity tracking app built with **React Native + Expo** that helps you understand where your time actually goes.

LifeFlow lets you assign your day to your most important life categories and control tracking instantly from your notification bar. — like **Study**, **Sleep**, and **Entertainment** — and automatically tracks how much time each one consumes.

Instead of tracking app usage, LifeFlow tracks **real-life activity states**.

---

## Why I Built This

I kept asking myself:

**"Where did my day go?"**

Traditional screen-time apps only show app usage, which wasn't enough.

Sometimes I was studying on my laptop.
Sometimes resting.
Sometimes wasting hours without realizing it.

I needed something simple that could answer one question:

**What is my life actually being spent on?**

So I built LifeFlow.

---

## Features

### Smart Activity Tracking

Start tracking any activity with one tap.

Switching to another activity automatically stops the previous one and starts the new session.

**Example:**
Study → Entertainment → Sleep

LifeFlow handles transitions automatically.

---

### Background Time Tracking

Tracking continues even if:

* The app is minimized
* The phone is locked
* You switch to another app

---

### Daily Dashboard

Instantly see how your day is distributed.

**Example:**

* Study — 2h 45m
* Sleep — 8h 10m
* Entertainment — 5h 20m

---

### Statistics & Insights

Analyze your performance across:

* Day
* Week
* Month
* Year

Track:

* Total time per category
* Coverage percentage
* Untracked time
* Activity distribution

---

### Clean Minimal UI

Designed for speed and focus.

No clutter.
No unnecessary complexity.
Just clarity.

---

## Tech Stack

* **React Native**
* **Expo**
* **AsyncStorage**
* **React Navigation**

---

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/55aa13d0-071c-4295-8552-0e5181285138" width="230" />
  <img src="https://github.com/user-attachments/assets/337381b9-96a8-4de0-a6d0-9d945e406cf1" width="230" />
  <img src="https://github.com/user-attachments/assets/19726faf-1e6f-47ab-96e1-f4205fe9d512" width="230" />
  <img src="https://github.com/user-attachments/assets/3ff3d9cc-67f1-4358-b58a-f172c39e2097" width="230" />
  <img src="https://github.com/user-attachments/assets/ec37e264-875f-4c1d-9247-a48a6d4d92b1" width="230" />
</p>

---

## Installation

Clone the repository:

```bash
git clone https://github.com/khaledeng/lifeflow.git
cd lifeflow
```

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npx expo start
```

---

## Project Structure

```plaintext
App.js
app.json
assets/
index.js
package.json
README.md
src/
 ├── components/
 │   └── AppShell.js
 ├── screens/
 │   ├── DataScreen.js
 │   ├── GoalsScreen.js
 │   ├── SetupScreen.js
 │   ├── StatsScreen.js
 │   └── TrackerScreen.js
 ├── storage.js
 ├── trackingService.js
 └── notifications.js
```

---

## Planned Features (v2)

* Home screen widget
* Smart inactivity detection
* Activity reminders
* Export / Import data
* Unlimited custom categories
* Pro analytics
* Cloud sync

---

## Monetization Plan

### Free Version

* Core tracking
* Up to 3 activity categories
* Daily statistics

### Pro Version

* Unlimited categories
* Export / Import
* Advanced analytics
* Smart reminders
* Cloud backup

---

## Philosophy

LifeFlow is based on a simple belief:

> You can't improve what you don't measure.

Awareness is the first step toward change.

---

## Author

**Khaled**
Software Engineer

Built to solve a personal time-awareness problem.
All rights reserved.
Source code is shared for portfolio and demonstration purposes only.
