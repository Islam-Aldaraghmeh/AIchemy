# Environments

This repo has two distinct runtimes:

1) **Frontend (website)** — Node.js + npm for the Vite/React app  
2) **Generator** — Python for `random_cof_generator.py` / `pycofbuilder`

## Frontend environment
- Use Node.js 20.x (LTS) or 18.x.
- Install dependencies once: `npm ci`
- Run dev server: `npm run dev`
- Production build: `npm run build`

## Python generator environment
- Python 3.10+ recommended (tested with 3.11).
- Create an isolated venv to avoid polluting the frontend toolchain:
  - `python3 -m venv .venv-cof`
  - `source .venv-cof/bin/activate` (Windows: `.venv-cof\\Scripts\\activate`)
  - `pip install --upgrade pip`
  - `pip install -r requirements.txt`

The generator saves new CIFs into `generated_cofs/` and the site picks them up automatically via `/api/generate-cof` or a rescan.

## Notes
- If `pycofbuilder` requires system libraries on your platform, install those first (per its docs).
- Keep the two environments separate: activate the venv only when running the Python generator; use plain `npm` for the website.
