# Dice Poker

A five-dice game that runs as a static web app and can be installed. See [PRODUCT.md](PRODUCT.md) for the requirements and [DESIGN.md](DESIGN.md) for the design decisions.

## Development

```sh
make run                  # serve on http://localhost:8000 and the LAN
make check                # verify versions agree and all precached files exist
make bump VERSION=1.0.1   # release: bump version.js + sw.js so installed apps update
```

Installing the app, playing offline and receiving updates need HTTPS or `localhost`. The `http://192.168…` LAN address from `make run` serves the game, but browsers won't install or update it from there.

Every change that should reach players needs `make bump`. Otherwise installed copies keep serving the cached old version.

## Roadmap

* Make the "Live Score" look nicer
* Add sound when throwing the dice / setting the value - but make it optional
* Add translations, depending on the browser's language settings - German, English, French, Spanish, Indonesian
* ~~Allow users to install it. Ensure that it updates when there is a new version available and that the user has an option to see the version~~ (done)
* Add quests - users should be able to see a few quests, but also add hidden quests. Give each quest a catchy name.
    * Categories of quests:
        * Time-based quests
        * Score-based quests
        * Hidden quests: When achieving those, a small card-like animation should be shown (e.g. a pop-up card with the quest name and a visualization of the quest name; after a short time, the backside of the card is shown with the condition)
            * Surgical Strike: Hit the exact 63-point Upper Section bonus threshold with 0 points to spare.
            * Against All Odds: Reroll all 5 dice on your final roll and still land a Full House or better.
            * Scratch & Survive: Voluntarily take a 0 in the Dice Poker box early, and still finish the game with over 225 points.
            * All-In: Hold only a single die after Roll 1 and turn it into five of a kind by Roll 3.
            * The Gambler: Score 25 or more points in "Chance" using at least three Ones or Twos.
            * Zero Waste: Finish an entire 13-round game without taking a single 0 (scratch) in any category.
            * Twin Peaks: Score five of a kind twice in a single game—one with low numbers (1–3) and one with high numbers (4–6).
            * The Escalator: Score a Small Straight, then a Large Straight, then a Full House on three consecutive turns.
        * Perfection: "Perfect X" (where x is the name of the field)
    * Specific quests
        * All of a kind: 3-, 4- and 5-of-a-kind
        
* Add a cheering sound and a firework anymation when "Dice Poker" is won - also rename it to "five of a kind"
* Show a "loading bar" for the bonus
