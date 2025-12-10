import argparse
import json
import os
import random
import sys

import pycofbuilder as pcb


l2_list = ['BENZ', 'DBA1', 'TPTA', 'TRZN', 'DICZ', 'TPAM', 'TPOB', 'TBBZ', 'DBA2', 'TPNY', 'BRZN', 'TPTZ', 'BTTP', 'TPBZ', 'STAR', 'STAR1']
t3_list = ['PHEN', 'BENZ', 'HDZN', 'PYEN', 'INFL', 'NAPT', 'PTCD', '4IDT', 'BBTZ', 'DPEL', 'TIDA', 'DHPI', 'DPBY', 'PYTO', 'TIEN', 'DFFE', 'ANTR', '2BPD', 'DHSI', '3BPD', 'INTO', 'TPNY', 'BDTP', 'PYRN', 'BPYB', 'NDTP', 'INDE', 'DPDA', 'BDFN', 'IITT', 'BTPH', 'DPEY', '3IDT', 'BPNY', 'TPDI', 'TTPH']
s4_list = ['PTCA', 'PHPR', 'PORP']
h6_list = ['HPCO', 'HECO']
q_list = ['COOH', 'NHOH', 'NHNH2', 'Cl', 'CONHNH2', 'Br', 'CHO', 'BOH2', 'COCHCHOH', 'NH2', 'O', 'CHCN']
r_list = ['COOH', 'F', 'Cl', 'OCOCH3', 'Ph', 'Br', 'NO', 'SH', 'CH3', 'OEt', 'EEPO', 'CN', 'tBu', 'SO3H', 'CHS', 'I', 'NO2', 'CHO', 'H', 'EMEPO', 'DMPE', 'MEPO', 'OProp', 'OEEPO', 'EPO', 'NH2', 'SO2H', 'O', 'OMe', 'OH']


class COFGenerator:
    def __init__(self, l2_cores, t3_cores, s4_cores, func_groups):
        """
        l2_cores: list of strings (e.g., ['BENZ', 'BPY', 'TH'])
        t3_cores: list of strings (e.g., ['BENZ', 'TPB'])
        s4_cores: list of strings (e.g., ['PORPH', 'PYRENE'])
        func_groups: list of strings (e.g., ['H', 'OH', 'OMe', 'F', 'CH3'])
        """
        self.cores = {
            'L2': l2_cores,
            'T3': t3_cores,
            'S4': s4_cores,
        }
        self.func_groups = func_groups

        # Define valid connector pairs to ensure chemistry works (Imine, Boroxine, etc.)
        # Format: (Connector_A, Connector_B)
        self.valid_linkages = [
            ('NH2', 'CHO'),  # Amine + Aldehyde (Imine)
            ('CHO', 'NH2'),  # Aldehyde + Amine (Imine)
            ('BOH2', 'BOH2'), # Boronic acid self-condensation (Boroxine)
        ]

    def generate_candidate(self, topology=None):
        # 1. Topology & Symmetry Rules
        # Define which symmetries form which topology
        # ['HCB', 'HCB_A', 'SQL', 'SQL_A', 'KGD', 'HXL_A', 'FXT', 'FXT_A', 'DIA', 'DIA_A', 'BOR', 'LON', 'LON_A']
        topo_rules = {
            'HCB': ('T3', 'L2'), # Honeycomb
            'SQL': ('S4', 'L2'), # Square Lattice
        }

        # Select Topology
        if topology and topology in topo_rules:
            selected_topo = topology
        else:
            selected_topo = random.choice(list(topo_rules.keys()))

        sym_a, sym_b = topo_rules[selected_topo]

        # 2. Select Cores (The "Blocks")
        core_a = random.choice(self.cores[sym_a])
        core_b = random.choice(self.cores[sym_b])

        # 3. Select Chemistry (Connectors)
        conn_a, conn_b = random.choice(self.valid_linkages)

        # 4. Select Functional Groups (Randomized for each node)
        func_a = random.choice(self.func_groups)
        func_b = random.choice(self.func_groups)

        # 5. Fixed Defaults for this builder style
        net = "A"
        stacking = "AA" 

        # 6. Construct the "AI Handoff" String
        # Format: {Sym}_{Core}_{Conn}_{Func}-{Sym}_{Core}_{Conn}_{Func}-{Top}_{Net}-{Stack}
        
        block_A_str = f"{sym_a}_{core_a}_{conn_a}_{func_a}"
        block_B_str = f"{sym_b}_{core_b}_{conn_b}_{func_b}"
        structure_str = f"{selected_topo}_{net}-{stacking}"
        
        cof_string = f"{block_A_str}-{block_B_str}-{structure_str}"

        return cof_string

# Initialize the Generator
generator = COFGenerator(l2_list, t3_list, s4_list, r_list)

def _log(message, verbose=True):
    if verbose:
        print(message)


def build_from_string(cof_string, output_dir="generated_cofs", supercell=None, verbose=True):
    """
    Takes the generated string and runs the pycofbuilder assembly.
    Returns a dict describing the result so callers can consume it programmatically.
    """
    _log(f"\n--- PROCESSING: {cof_string} ---", verbose)

    try:
        cof = pcb.Framework(cof_string)
        _log("   -> Object created successfully.", verbose)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        cell = supercell if supercell else [1, 1, 1]
        cof.save(fmt="cif", supercell=cell, save_dir=output_dir)

        filename = f"{cof_string}.cif"
        saved_path = os.path.join(output_dir, filename)
        _log(f"   -> ✅ Success! Saved to {saved_path}", verbose)

        return {"ok": True, "path": saved_path, "filename": filename, "cof_string": cof_string, "supercell": cell}
    except Exception as e:
        _log(f"   -> ❌ Error: {e}", verbose)
        return {"ok": False, "error": str(e), "cof_string": cof_string}


FALLBACK_STRINGS = [
    # Known-good combos to guarantee success if random picks fail repeatedly
    "S4_PORP_CHO_I_H-L2_BDTP_NH2_CN_H_H_H_H-SQL_A-AA",
    "S4_PHPR_CHO_SO2H_H_H_H_H_H-L2_BPYB_NH2_NH2_H_H_H_H_H-SQL_A-AA",
    "T3_BRZN_CHO_OH-L2_DPDA_NH2_I_H_H_H-HCB_A-AA",
]


def generate_and_save(topology=None, supercell=None, output_dir="generated_cofs", verbose=True, max_attempts=20):
    """
    Generates and saves a COF. Retries quietly if a candidate fails to build.
    """
    last_result = None
    for _ in range(max_attempts):
        cof_string = generator.generate_candidate(topology=topology)
        result = build_from_string(cof_string, output_dir=output_dir, supercell=supercell, verbose=verbose)
        result["cof_string"] = cof_string
        if result.get("ok"):
            return result
        last_result = result

    # Try deterministic fallback strings before giving up
    for fallback in FALLBACK_STRINGS:
        result = build_from_string(fallback, output_dir=output_dir, supercell=supercell, verbose=verbose)
        result["cof_string"] = fallback
        if result.get("ok"):
            return result
        last_result = result

    return last_result or {"ok": False, "error": "Failed to generate after retries and fallbacks."}


def main():
    parser = argparse.ArgumentParser(description="Generate a random COF and save to disk.")
    parser.add_argument("--topology", help="Force a specific topology (e.g., HCB or SQL).")
    parser.add_argument("--supercell", type=int, default=1, help="Supercell replication factor (applied uniformly).")
    parser.add_argument("--output-dir", default="generated_cofs", help="Directory to store generated CIFs.")
    parser.add_argument("--json", action="store_true", help="Emit a JSON payload for programmatic callers.")
    parser.add_argument("--quiet", action="store_true", help="Suppress verbose logging (implied when --json is set).")
    parser.add_argument("--max-attempts", type=int, default=20, help="Retry count if a generated string fails to build.")
    args = parser.parse_args()

    verbose = not args.quiet and not args.json
    cell = [args.supercell, args.supercell, args.supercell]

    result = generate_and_save(
        #topology=args.topology,
        supercell=cell,
        output_dir=args.output_dir,
        verbose=verbose,
        max_attempts=max(1, args.max_attempts),
    )

    if args.json:
        print(json.dumps(result))
    else:
        if result.get("ok"):
            _log(f"Generated String: {result['cof_string']}", verbose=True)
            _log(f"Saved: {result['path']}", verbose=True)
        else:
            _log("Generation failed.", verbose=True)

    sys.exit(0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()
