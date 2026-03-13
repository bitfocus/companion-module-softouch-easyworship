## Softouch EasyWorship

This module controls EasyWorship 7.3+ over your local network using Bonjour/mDNS discovery.

### Setup

1. EasyWorship must be running on the same network as Companion.
2. Add the module in Companion, enter a **Remote Name**, and select your EasyWorship server from the dropdown.
3. On first connection, approve the pairing request on the EasyWorship machine. Subsequent connections with the same Companion instance pair automatically.

Bonjour (mDNS) must be available on the network. On Windows, installing iTunes or Apple's Bonjour Print Services provides this. Most macOS and Linux systems have it by default.

### Actions

**Display Overlays**
* Toggle Logo — Logo and Black are mutually exclusive (enabling one disables the other)
* Toggle Black — Black and Logo are mutually exclusive
* Toggle Clear — Independent of Logo and Black

**Slide Navigation**
* Previous Slide
* Next Slide
* Go to Slide — Jump to a specific slide number

**Schedule Navigation**
* Previous Schedule
* Next Schedule
* Go to Schedule — Jump to a specific schedule item number

**Build Navigation**
* Previous Build — Navigate animation steps within a slide
* Next Build

**Position Jumps**
* Presentation Start — Go to the first slide of the current item
* Slide Start — Go to the beginning of the current slide

**Media Playback**
* Play
* Pause
* Toggle Play/Pause

**Connection**
* Reconnect to EasyWorship — Full reset: tears down the connection and restarts discovery

### Feedbacks

Boolean feedbacks that highlight buttons when active:

* **Logo Active** — Highlights when the Logo overlay is displayed
* **Black Active** — Highlights when the Black screen overlay is displayed
* **Clear Active** — Highlights when the Clear overlay is active
* **Live Preview Active** — Highlights when Live Preview is enabled
* **Connected & Paired** — Highlights when connected and paired with EasyWorship

### Variables

* `$(softouch-easyworship:Logo)` — Logo state (0 = Off, 1 = On)
* `$(softouch-easyworship:Black)` — Black state (0 = Off, 1 = On)
* `$(softouch-easyworship:Clear)` — Clear state (0 = Off, 1 = On)
* `$(softouch-easyworship:LivePreview)` — Live Preview state (0 = Off, 1 = On)
* `$(softouch-easyworship:Connected)` — Connection status (0 = Disconnected, 1 = Connected & Paired)

### Troubleshooting

**No servers in the dropdown?**
* Verify EasyWorship is running on the network.
* Ensure Bonjour/mDNS is available (see Setup above).
* Try the **Reconnect to EasyWorship** action or restart Companion.

**Connected but not paired?**
* Check the EasyWorship machine for a pending pairing approval dialog.
* The module will automatically re-send the pair request on each button press.

**Connection drops during a service?**
* The module automatically reconnects with aggressive retry timing and never stops trying.
* Use the `$(softouch-easyworship:Connected)` variable or the **Connected & Paired** feedback to show connection status on a button.
