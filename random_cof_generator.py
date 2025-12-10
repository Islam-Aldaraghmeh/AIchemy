import pandas as pd
import random
import time
import os
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

# Generate a candidate string
random_cof_string = generator.generate_candidate()

print(f"Generated String: {random_cof_string}")


def build_from_string(cof_string):
    """
    Takes the generated string and runs the pycofbuilder assembly.
    """
    print(f"\n--- PROCESSING: {cof_string} ---")
    
    
    try:
        # STEP 1: LOAD
        # The string contains all info: Geometry, Chemistry, Topology
        cof = pcb.Framework(cof_string)
        print(f"   -> Object created successfully.")

        # STEP 2: BUILD & SAVE
        output_dir = "generated_cofs"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Supercell 1x1x1 is faster for testing, 2x2x2 looks better
        cof.save(fmt='cif', supercell=[1, 1, 1], save_dir=output_dir)
        
        print(f"   -> ✅ Success! Saved to {output_dir}/{cof_string}.cif")
        return True

    except Exception as e:
        print(f"   -> ❌ Error: {e}")
        return False

# ==========================================
# EXECUTION
# ==========================================

# 1. Generate 3 Random COFs
print("1. Generating Candidates...")
candidate = generator.generate_candidate()

# 2. Build them
print("\n2. Building Structures...")

build_from_string(candidate)