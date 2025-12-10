import argparse
import json
import os
import random
import sys

# Wrap import in try/except to handle environment issues gracefully
try:
    import pycofbuilder as pcb
except ImportError:
    print("Error: pycofbuilder not found. Please install it via 'pip install pycofbuilder'")
    sys.exit(1)

# --- CONFIGURATION ---

# Ensure these codes exist in your pycofbuilder library 'data' folder
# I have removed potentially problematic codes or duplicates
L2_CORES = ['BENZ', 'TPTA', 'TRZN', 'DICZ', 'TPAM', 'TPOB', 'DBA1', 'TPNY', 'BRZN', 'TPTZ', 'BTTP', 'TPBZ']
T3_CORES = ['BENZ', 'TPB', 'TRZN', 'HBC', 'PYRE', 'TRUX', 'TPA', 'BTP', 'DTP', 'HAT'] 
S4_CORES = ['PORP', 'PYRE', 'PHPR']
H6_CORES = ['HPCO', 'HECO']

# Functional groups (R-groups)
# Note: 'H' is most likely to succeed. Bulky groups like 'tBu' often fail generation.
FUNC_GROUPS = ['H', 'OH', 'OMe', 'F', 'Cl', 'Br', 'CH3', 'CN', 'COOH', 'NO2', 'tBu', 'Ph']

class COFGenerator:
    def __init__(self):
        self.cores = {
            'L2': L2_CORES,
            'T3': T3_CORES,
            'S4': S4_CORES,
            'H6': H6_CORES
        }
        self.func_groups = FUNC_GROUPS

        # (Connector_A, Connector_B) pairs
        self.valid_linkages = [
            ('NH2', 'CHO'),      # Imine (Schiff Base)
            ('CHO', 'NH2'),      # Imine (Reverse)
            ('BOH2', 'BOH2'),    # Boroxine
            ('NHNH2', 'CHO'),    # Hydrazone
            ('CHO', 'NHNH2'),    # Hydrazone (Reverse)
            ('CHCN', 'CHO'),     # Knoevenagel (Cyanovinylene) - checks required
            ('CHO', 'CHCN'),     # Knoevenagel (Reverse)
        ]

        # Map topology to required node symmetries
        self.topo_rules = {
            'HCB': ('T3', 'L2'), # Honeycomb (Hexagonal)
            'SQL': ('S4', 'L2'), # Square Lattice
            'KGD': ('T3', 'L2'), # Kagome (Dual Honeycomb)
            'HXL': ('H6', 'L2'), # Hexagonal Lattice (6-connected)
        }

    def generate_candidate(self, topology=None):
        # 1. Select Topology
        if topology:
            if topology not in self.topo_rules:
                raise ValueError(f"Topology {topology} not defined in rules.")
            selected_topo = topology
        else:
            selected_topo = random.choice(list(self.topo_rules.keys()))

        sym_a, sym_b = self.topo_rules[selected_topo]

        # 2. Select Cores
        core_a = random.choice(self.cores[sym_a])
        core_b = random.choice(self.cores[sym_b])

        # 3. Select Chemistry (Connectors)
        conn_a, conn_b = random.choice(self.valid_linkages)

        # 4. Select Functional Groups
        # weighted random choice: Give 'H' a higher probability to ensure geometric success
        # This helps avoid failing 20 times in a row due to steric clashes
        func_a = self._pick_func_group()
        func_b = self._pick_func_group()

        # 5. Defaults
        net = "A" 
        stacking = "AA" # Eclipsed is standard for 2D COFs

        # 6. Format: {Sym}_{Core}_{Conn}_{Func}
        block_A_str = f"{sym_a}_{core_a}_{conn_a}_{func_a}"
        block_B_str = f"{sym_b}_{core_b}_{conn_b}_{func_b}"
        
        # PyCOFBuilder structure string
        # Format: BlockA-BlockB-Topology_Net-Stacking
        cof_string = f"{block_A_str}-{block_B_str}-{selected_topo}_{net}-{stacking}"

        return cof_string

    def _pick_func_group(self):
        """Pick a functional group, favoring Hydrogen (H) for stability."""
        if random.random() < 0.3:
            return 'H'
        return random.choice(self.func_groups)

# --- LOGGING & BUILDER ---

def _log(message, verbose=True):
    if verbose:
        print(message, file=sys.stderr)

def build_from_string(cof_string, output_dir, supercell, verbose=True):
    _log(f"Attempting: {cof_string}", verbose)
    try:
        cof = pcb.Framework(cof_string)
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)

        # Generating the CIF
        cof.save(fmt="cif", supercell=supercell, save_dir=output_dir)
        
        filename = f"{cof.name}.cif" # Use internal name property if available, else construct it
        saved_path = os.path.join(output_dir, filename)
        
        # Double check file creation (sometimes pcb fails silently)
        if not os.path.exists(saved_path):
             # Try constructing filename manually if cof.name varies
             filename = f"{cof_string}.cif"
             saved_path = os.path.join(output_dir, filename)

        if os.path.exists(saved_path):
             return {"ok": True, "path": saved_path, "filename": filename}
        else:
             return {"ok": False, "error": "File not written to disk"}

    except Exception as e:
        # Common errors: "Atoms too close", "Core not found"
        return {"ok": False, "error": str(e)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--topology", help="Force topology (HCB, SQL, KGD, HXL)")
    parser.add_argument("--supercell", type=int, default=1)
    parser.add_argument("--output-dir", default="generated_cofs")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--max-attempts", type=int, default=20)
    args = parser.parse_args()

    generator = COFGenerator()
    cell = [args.supercell, args.supercell, args.supercell]
    
    verbose = not args.json
    
    # Retry Loop
    result = {"ok": False, "error": "Max attempts reached"}
    
    for i in range(args.max_attempts):
        candidate_str = generator.generate_candidate(topology=args.topology)
        result = build_from_string(candidate_str, args.output_dir, cell, verbose)
        result["cof_string"] = candidate_str
        
        if result["ok"]:
            break
        else:
            _log(f"   [Attempt {i+1} Failed]: {result.get('error')}", verbose)

    # Output Handling
    if args.json:
        print(json.dumps(result))
    else:
        if result["ok"]:
            print(f"\nSUCCESS\nCOF: {result['cof_string']}\nSaved: {result['path']}")
        else:
            print("\nFAILURE: Could not generate a valid COF.")
            sys.exit(1)

if __name__ == "__main__":
    main()