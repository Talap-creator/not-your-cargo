# Builds the Title-config payloads for NYC skins, the cargo crate and leaderboards.
# Reference copy only (the platform stores the live config); applied with the Title MCP.
import json, os, sys

SKINS = [
    # id, ru, en, rarity, hex tint
    ("paint_rust", "Ржавчина", "Rust", "Common", "c4612a"),
    ("paint_sand", "Песок", "Sand", "Common", "d8b878"),
    ("paint_graphite", "Графит", "Graphite", "Common", "4a4f57"),
    ("paint_toxic", "Токсик", "Toxic", "Rare", "9be22d"),
    ("paint_neon", "Неон", "Neon", "Rare", "2ee6ff"),
    ("paint_camo", "Камуфляж пустыни", "Desert camo", "Rare", "8a7a4e"),
    ("paint_chrome", "Хром", "Chrome", "Epic", "dfe6ee"),
    ("paint_blood", "Кровавая луна", "Blood moon", "Epic", "c0182b"),
    ("paint_gold", "Золотой курьер", "Golden courier", "Legendary", "ffc824"),
]
WEIGHT = {"Common": 600, "Rare": 280, "Epic": 100, "Legendary": 20}
PRICE_NYC = int(os.environ.get("PRICE_NYC", "50"))

def item(i, ru, en, rarity, tint):
    return {"ItemID": i, "CatalogID": "Skin", "ItemClass": "Paint", "DisplayName": en, "Description": ru,
            "Tags": ["skin", "paint", "cosmetic"], "IsStackable": True, "IsTradable": False, "Weight": 0,
            "Metadata": {"RarityID": rarity}, "CustomData": {"tint": tint}}

def grant(i):
    return {"Standard": {"Entries": [{"Type": "Item", "CatalogID": "Skin", "ItemID": i, "Amount": 1}]}}

def items_payload(current):
    cats = dict(current.get("Catalogs") or {})
    cats["Skin"] = {"Items": {s[0]: item(*s) for s in SKINS}}
    return {**current, "Catalogs": cats}

lootbox = {"Definitions": {"cargo_crate": {
    "LootboxID": "cargo_crate",
    "PriceOptions": {"nyc": {"OptionID": "nyc", "Name": f"{PRICE_NYC} NYCARGO",
                             "Cost": {"Standard": {"Entries": [{"Type": "CryptoCurrency", "CurrencyID": "Main", "Amount": PRICE_NYC}]}}}},
    "RewardSlots": [{"SlotID": "paint", "MinRolls": 1, "MaxRolls": 1,
                     "Pool": [{"Reward": grant(s[0]), "Weight": WEIGHT[s[3]]} for s in SKINS]}],
    # every 10th crate also gives an Epic or the Legendary
    "PityRules": [{"RuleID": "epic10", "Threshold": 10,
                   "Pool": [{"Reward": grant(s[0]), "Weight": WEIGHT[s[3]]} for s in SKINS if s[3] in ("Epic", "Legendary")]}],
    "MaxOpenCount": 10}}}

def lb(i, name, unit, agg, sched):
    return {"LeaderboardID": i, "DisplayName": name, "ScoreDisplayName": unit, "IsEnabled": True,
            "ScoreAggregation": agg, "Schedule": sched, "TopUsersLimit": 100, "MinScoreToEnterTop": 1, "BracketSize": 0}

leaderboard = {"Definitions": {
    "campaign_score": lb("campaign_score", "Campaign", "Points", "BestScore", {"Mode": "AlwaysOn", "IsActive": True}),
    "duel_wins_weekly": lb("duel_wins_weekly", "Duel wins (week)", "Wins", "Sum",
                           {"Mode": "Cyclic", "IsActive": True, "Cyclic": {"Reset": "Weekly", "ClaimGraceHours": 0}}),
}}

if __name__ == "__main__":
    what = sys.argv[1]
    if what == "items":
        cur = json.load(open(sys.argv[2], encoding="utf8"))["Data"]
        print(json.dumps(items_payload(cur), ensure_ascii=False))
    elif what == "lootbox":
        print(json.dumps(lootbox, ensure_ascii=False))
    elif what == "leaderboard":
        print(json.dumps(leaderboard, ensure_ascii=False))
