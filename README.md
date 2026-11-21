# Ultimate Playbook

Animated ultimate frisbee plays and drills for training sessions, with a drill editor made for the iPad.

Open `index.html` in a browser, or use the GitHub Pages site for this repository.

## Watching a play or drill

- **Drills** opens the list of plays and drills.
- Tap the field to play the next step and stop at its end. The play button runs the whole thing.
- The caption under the field shows the current step's coaching note and throw.
- ⓘ shows the summary. The options button sets speed, pausing after each step, looping, arrows and defense.
- The share button gives a link to the drill. Built-in drills link by name; drills you drew are packed into the link itself, so it works without any server or account. Whoever opens it can watch it and tap **Save to my drills**.
- The field always runs along the longer side of the screen. The offense attacks toward the pink end zone ("Score here").

Built in: vertical stack, horizontal stack, dump & swing, go-to drill, box drill, angel drill, and the angel drill with a fake and cut back.

## Drawing a drill

**Draw a new drill** opens the full-screen editor, starting from a blank field or from a copy of any built-in or saved drill. **Edit a copy** on a drill does the same for the one you're watching, and the Drill tab can also copy another drill in.

- **Tools** (left rail): Select, Offense, Defense, Group, Cone, Throw, Erase, and Multi for multi-select. Tools with options open them beside the tool.
- **Setup** is where everyone starts. Each **step** holds runs and at most one throw. Timing is automatic: the receiver and the disc reach the catch point together.
- **Throws**: type (backhand, forehand, hammer, scoober, thumber, blade, push pass), flight (straight or bent), and an optional pump fake.
- **Defense**: a defender can be free, follow an attacker, or mark: each player in a row, only the handler spot, or whoever has the disc. Each mark has a force (left, straight up, right). Facing can follow their player, watch the disc, or be fixed with the rotate handle.
- **Drill tab**: 7 v 7 or 5 v 5, full field (100 × 37 m) or small field (75 × 25 m), formations (vertical stack, vertical stack with dump, horizontal stack, side stack) and person defense with a force.
- Keyboard: V O D G C T E switch tools, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S save, arrows nudge.

Drills you draw are saved in this browser (local storage). To move one to another device, share its link and save it there.

## To do

- Make it installable on the iPad home screen and usable offline (web app manifest and service worker).
- Saving drills to a shared place for the whole team (for now each browser keeps its own).
