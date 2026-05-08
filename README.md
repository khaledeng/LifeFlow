# LifeFlow

![Expo](https://img.shields.io/badge/Expo-React%20Native-black)
![Platform](https://img.shields.io/badge/platform-Android-blue)

A minimalist productivity tracking app built with **React Native + Expo** that helps you understand where your time actually goes.

LifeFlow lets you assign your day to your most important life categories — like **Study**, **Sleep**, and **Entertainment** — and automatically tracks how much time each one consumes.

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

| Tracker                                     
| ------------------------------------------- 
<img width="912" height="1595" alt="Screenshot 2026-05-08 080653" src="https://github.com/user-attachments/assets/8678ad54-3369-4660-b175-c5147da50eff" />
| Statistics                                   |
<img width="1277" height="1665" alt="Screenshot 2026-05-08 080624" src="https://github.com/user-attachments/assets/46c110e8-ffac-424e-8988-681c7bfc194f" />


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
src/
 ├── navigation/
 ├── screens/
 │   ├── SetupScreen
 │   ├── TrackerScreen
 │   └── StatsScreen
 ├── storage/
App.js
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
