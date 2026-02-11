# React Native Application

## Overview

This project is a React Native mobile application.  
This document explains how to **set up**, **run**, and **build** the application for Android and iOS.

---

## Requirements

Before starting, make sure you have the following installed:

### Required Software

- **Node.js** (>= 20.x)
- **npm**
- **React Native CLI**
- **Git**

### Android Development

- Android Studio
- Android SDK
- Android Emulator or physical device
- Java (JDK 17 or later)

### iOS Development (macOS only)

- macOS
- Xcode (latest version)
- CocoaPods

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-name>
npm install
```

### 2. iOS Pods Installation (iOS only)

```bash
cd ios
pod install
cd ..
```

### 3. Running the application

```bash
npm start
```

Make sure an emulator or device is running:

#### To run on Android

```bash
npm run android
```

#### To run on iOS

```bash
npm run ios
```
