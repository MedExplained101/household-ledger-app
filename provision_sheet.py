#!/usr/bin/env python3
"""
Household Ledger — provision the Google Sheet

Creates a new "Household Ledger" spreadsheet with the six tabs described in
household-ledger-sheets-schema.md (Catalog, ShoppingList, Settings, PriceLog,
Inventory, Stores), writes their header rows, sets the default Settings row,
and seeds Catalog from catalog_seed.csv.

Reuses the same OAuth pattern as the sibling 180-on-Circular project's
common_auth.py: credentials.json/token.json live in this repo's root
(current working directory) by default, overridable via CREDENTIALS_PATH/
TOKEN_PATH env vars. Copy the same credentials.json you already downloaded
for that project into this repo's root to skip re-authorizing from scratch
(a fresh token.json will still be written here, scoped to Sheets only).

USAGE:
    python provision_sheet.py

Prints the new spreadsheet's ID and URL at the end -- you'll need the ID for
every Google Sheets node's documentId in Household_Ledger_List_Budget_Webhook_Agent.json
(and the other four workflow JSON files) once you import them into n8n.
"""

import csv
import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Same convention as the sibling 180-on-Circular project's common_auth.py:
# credentials.json/token.json in the current working directory (i.e. this
# repo's root), overridable via CREDENTIALS_PATH/TOKEN_PATH env vars.
CREDENTIALS_FILE = Path(os.environ.get("CREDENTIALS_PATH", "credentials.json"))
TOKEN_FILE = Path(os.environ.get("TOKEN_PATH", "token.json"))

SPREADSHEET_TITLE = "Household Ledger"

TABS = {
    "Catalog": ["item", "category", "store", "price", "unit_price", "size", "unit_label", "last_updated", "confidence", "product_url"],
    "ShoppingList": ["item", "category", "store", "price", "qty", "cadence", "added_date"],
    "Settings": ["budget", "cadence", "CheckIn_Status", "CheckIn_ResumeURL"],
    "PriceLog": ["item", "store", "price", "date", "status", "scraped_at"],
    "Inventory": ["item", "status", "last_purchased_date", "last_finished_date", "avg_days_to_finish", "cycle_count"],
    "Stores": ["store", "address", "lat", "long", "distance_from_home_mi", "est_trip_cost"],
}

DEFAULT_SETTINGS_ROW = ["200", "Week", "idle", ""]

CATALOG_SEED_CSV = Path(__file__).parent / "catalog_seed.csv"


def get_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception:
            creds = None
    if not creds or not creds.valid:
        if not CREDENTIALS_FILE.exists():
            sys.exit(
                f"Missing {CREDENTIALS_FILE.resolve()}. Copy the same credentials.json you "
                f"already downloaded from Google Cloud Console for the 180-on-Circular "
                f"project into this repo's root folder (next to provision_sheet.py), or "
                f"download a fresh OAuth Desktop client if you'd rather keep the two "
                f"projects on separate Google Cloud credentials."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
        creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return build("sheets", "v4", credentials=creds)


def create_spreadsheet(service):
    body = {
        "properties": {"title": SPREADSHEET_TITLE},
        "sheets": [{"properties": {"title": name}} for name in TABS],
    }
    result = service.spreadsheets().create(body=body, fields="spreadsheetId,sheets.properties").execute()
    spreadsheet_id = result["spreadsheetId"]
    print(f"Created spreadsheet '{SPREADSHEET_TITLE}' ({spreadsheet_id})")
    return spreadsheet_id


def write_headers_and_seed(service, spreadsheet_id):
    data = []
    for tab, headers in TABS.items():
        data.append({"range": f"{tab}!A1", "values": [headers]})
    data.append({"range": "Settings!A2", "values": [DEFAULT_SETTINGS_ROW]})

    if CATALOG_SEED_CSV.exists():
        with open(CATALOG_SEED_CSV, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader)  # header, already written above
            seed_rows = list(reader)
        if seed_rows:
            data.append({"range": "Catalog!A2", "values": seed_rows})
            print(f"Seeding Catalog with {len(seed_rows)} rows from {CATALOG_SEED_CSV.name}")
    else:
        print(f"Note: {CATALOG_SEED_CSV.name} not found next to this script -- Catalog left empty.")

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"valueInputOption": "USER_ENTERED", "data": data},
    ).execute()
    print("Headers, default Settings row, and Catalog seed written.")


def main():
    service = get_service()
    spreadsheet_id = create_spreadsheet(service)
    write_headers_and_seed(service, spreadsheet_id)
    print()
    print(f"Spreadsheet ID: {spreadsheet_id}")
    print(f"Open it here: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    print()
    print("Next: drop this ID into the documentId field of every Google Sheets node in")
    print("Household_Ledger_List_Budget_Webhook_Agent.json once you import it into n8n")
    print("(replacing the REPLACE_WITH_SHEET_ID placeholder), then do the same for the")
    print("other four workflow JSON files as you deploy them.")


if __name__ == "__main__":
    main()
