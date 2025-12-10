#!/usr/bin/env python3
"""
Random COF generator using pyCOFBuilder, with chemistry-aware filtering.

Requirements:
    pip install pycofbuilder pandas

This script will:
  1. Query pyCOFBuilder for available building blocks.
  2. Filter them according to user-defined cores (L2/T3/S4/H6), connectors (Q) and R-groups.
  3. Build random HCB and SQL COFs with valid connectivity.
  4. Save CIFs and a CSV log of what succeeded or failed.
"""

import os
import random
import time
from typing import Dict, List, Tuple, Optional

import pandas as pd
import pycofbuilder as pcb
from pycofbuilder.building_block import BuildingBlock


# ============================
# USER FILTERS (YOUR LISTS)
# ============================

# L2 and T3 lists were swapped in your original snippet; these match
# the nomenclature docs: T3 = triangular, L2 = linear.
L2_CORES = [
    'PHEN', 'BENZ', 'HDZN', 'PYEN', 'INFL', 'NAPT', 'PTCD', '4IDT', 'BBTZ',
    'DPEL', 'TIDA', 'DHPI', 'DPBY', 'PYTO', 'TIEN', 'DFFE', 'ANTR', '2BPD',
    'DHSI', '3BPD', 'INTO', 'TPNY', 'BDTP', 'PYRN', 'BPYB', 'NDTP', 'INDE',
    'DPDA', 'BDFN', 'IITT', 'BTPH', 'DPEY', '3IDT', 'BPNY', 'TPDI', 'TTPH'
]

T3_CORES = [
    'BENZ', 'DBA1', 'TPTA', 'TRZN', 'DICZ', 'TPAM', 'TPOB', 'TBBZ',
    'DBA2', 'TPNY', 'BRZN', 'TPTZ', 'BTTP', 'TPBZ', 'STAR', 'STAR1'
]

S4_CORES = ['PTCA', 'PHPR', 'PORP']
H6_CORES = ['HPCO', 'HECO']

# Connector groups (Q) you want to allow
Q_CONNECTORS = [
    'COOH', 'NHOH', 'NHNH2', 'Cl', 'CONHNH2', 'Br', 'CHO',
    'BOH2', 'COCHCHOH', 'NH2', 'O', 'CHCN'
]

# R-groups you want to allow on the cores
R_GROUPS = [
    'COOH', 'F', 'Cl', 'OCOCH3', 'Ph', 'Br', 'NO', 'SH', 'CH3', 'OEt', 'EEPO',
    'CN', 'tBu', 'SO3H', 'CHS', 'I', 'NO2', 'CHO', 'H', 'EMEPO', 'DMPE',
    'MEPO', 'OProp', 'OEEPO', 'EPO', 'NH2', 'SO2H', 'O', 'OMe', 'OH'
]


# =======================================
# COF GENERATOR CLASS (ROBUST VERSION)
# =======================================

class COFGenerator:
    """
    Chemistry-aware random COF generator using pyCOFBuilder building blocks.

    Key ideas:
    - Only use building blocks that actually exist in pyCOFBuilder's library.
    - Respect connectivity required by each topology (HCB → 3–3, SQL → 4–4).
    - Randomly choose building blocks, topology and stacking.
    - Catch all errors when building and keep going.
    """

    def __init__(
        self,
        L2_cores: List[str],
        T3_cores: List[str],
        S4_cores: List[str],
        H6_cores: List[str],
        q_connectors: List[str],
        r_groups: List[str],
        out_dir: str = "generated_cofs",
        seed: Optional[int] = None,
    ):
        if seed is not None:
            random.seed(seed)

        self.out_dir = out_dir
        os.makedirs(self.out_dir, exist_ok=True)

        # Save whitelists
        self.core_whitelist: Dict[str, List[str]] = {
            "L2": L2_cores,
            "T3": T3_cores,
            "S4": S4_cores,
            "H6": H6_cores,
        }
        self.q_whitelist = list(set(q_connectors))
        self.r_whitelist = list(set(r_groups)) + ["H"]  # always allow H as "no substituent"

        # pyCOFBuilder helpers
        self.bb_helper = BuildingBlock()
        self.framework_helper = pcb.Framework()  # used for available nets & stacking

        # Filled in by _build_block_library()
        # name -> BuildingBlock object
        self.blocks: Dict[str, BuildingBlock] = {}
        # connectivity (2,3,4,6,...) -> [names]
        self.blocks_by_connectivity: Dict[int, List[str]] = {}

        # Topology rules: we keep this intentionally simple and robust
        # Use connectivity (not "L2/T3/S4") because pyCOFBuilder enforces connectivity
        self.topology_rules: Dict[str, Tuple[int, int]] = {
            "HCB": (3, 3),   # 2D hexagonal net – two 3-connected nodes
            "SQL": (4, 4),   # 2D square net – two 4-connected nodes
            # you can add more later when you feel comfortable
            # e.g. "HCB_A": (3, 3), etc.
        }

        # Stacking options per topology
        self.stacking_by_topology: Dict[str, List[str]] = {
            top: self.framework_helper.available_stacking[top]
            for top in self.topology_rules.keys()
        }

        print(">>> Building library of allowed building blocks ...")
        self._build_block_library()
        self._summary()

    # -----------------------------
    # Library construction
    # -----------------------------

    def _build_block_library(self):
        """
        Use pyCOFBuilder to discover all building blocks matching:
        - desired symmetry (L2/T3/S4/H6)
        - whitelisted cores
        - whitelisted connectors
        - whitelisted R-groups
        """
        # Available connectors and R-groups in pyCOFBuilder
        available_q = set(self.bb_helper.get_available_conector())
        available_r = set(self.bb_helper.get_available_R())

        # Intersect with user lists
        allowed_q = sorted(available_q.intersection(self.q_whitelist))
        allowed_r = sorted(available_r.intersection(self.r_whitelist))

        if not allowed_q:
            raise RuntimeError(
                "None of your Q_CONNECTORS exist in pyCOFBuilder. "
                "Check spelling / version or relax your filters."
            )

        if not allowed_r:
            raise RuntimeError(
                "None of your R_GROUPS exist in pyCOFBuilder. "
                "Check spelling / version or relax your filters."
            )

        print(f"  Allowed connectors (Q): {allowed_q}")
        print(f"  Allowed R-groups (subset used for filtering): {allowed_r}")

        # For each symmetry, query pyCOFBuilder for building blocks using that
        # connectivity group, then filter according to your whitelists.
        for sym, core_list in self.core_whitelist.items():
            if not core_list:
                continue

            for q in allowed_q:
                try:
                    bb_names = self.bb_helper.get_buildingblock_list(sym, q)
                except Exception as e:
                    print(f"    Skipping {sym} with connector {q} ({e})")
                    continue

                if not bb_names:
                    continue

                for name in bb_names:
                    # Example name: L2_BENZ_CHO_H_H
                    parts = name.split("_")
                    if len(parts) < 3:
                        continue

                    symm = parts[0]
                    core = parts[1]
                    connector = parts[2]
                    r_parts = parts[3:] if len(parts) > 3 else []

                    # Filter by core whitelist
                    if core_list and core not in core_list:
                        continue

                    # Filter by R-groups (only keep if all R are allowed)
                    if any(r not in allowed_r and r != "H" for r in r_parts):
                        continue

                    # Instantiate the building block once to get connectivity
                    try:
                        bb = BuildingBlock(name=name)
                    except AssertionError:
                        # Invalid / incomplete BB definition, skip it
                        continue
                    except Exception as e:
                        print(f"    Error creating BuildingBlock({name}): {e}")
                        continue

                    conn = getattr(bb, "connectivity", None)
                    if conn is None:
                        continue

                    self.blocks[name] = bb
                    self.blocks_by_connectivity.setdefault(conn, []).append(name)

        if not self.blocks:
            raise RuntimeError("No building blocks passed the filters – nothing to generate with.")

    def _summary(self):
        print(">>> Building block summary")
        total = len(self.blocks)
        print(f"  Total allowed building blocks: {total}")
        for conn, names in sorted(self.blocks_by_connectivity.items()):
            print(f"    connectivity {conn}: {len(names)} blocks")

        # Check that we actually have blocks for the nets we want to use
        for topo, (c1, c2) in self.topology_rules.items():
            n1 = len(self.blocks_by_connectivity.get(c1, []))
            n2 = len(self.blocks_by_connectivity.get(c2, []))
            if n1 == 0 or n2 == 0:
                print(
                    f"  WARNING: topology {topo} requires connectivity "
                    f"({c1}, {c2}) but we only have ({n1}, {n2}) blocks."
                )

    # -----------------------------
    # Random generation
    # -----------------------------

    def random_cof_name(self, topology: Optional[str] = None) -> str:
        """
        Create a random COF name string that pyCOFBuilder understands:
            BB1-BB2-TOPOLOGY-STACKING
        where BB1 and BB2 already exist and match the connectivity required.
        """
        if topology is None:
            topology = random.choice(list(self.topology_rules.keys()))
        if topology not in self.topology_rules:
            raise ValueError(f"Unknown topology {topology}")

        c1, c2 = self.topology_rules[topology]

        bb1_list = self.blocks_by_connectivity.get(c1, [])
        bb2_list = self.blocks_by_connectivity.get(c2, [])

        if not bb1_list or not bb2_list:
            raise RuntimeError(
                f"No building blocks available with connectivity ({c1}, {c2}) "
                f"for topology {topology}."
            )

        bb1_name = random.choice(bb1_list)
        bb2_name = random.choice(bb2_list)

        # Avoid trivial duplicates BB1 == BB2 when c1 == c2
        if c1 == c2 and len(bb1_list) > 1:
            while bb2_name == bb1_name:
                bb2_name = random.choice(bb2_list)

        stacking_options = self.stacking_by_topology[topology]
        stacking = random.choice(stacking_options)

        cof_name = f"{bb1_name}-{bb2_name}-{topology}-{stacking}"
        return cof_name

    def try_build_and_save(
        self,
        cof_name: str,
        fmt: str = "cif",
        supercell: Tuple[int, int, int] = (1, 1, 1),
    ) -> Tuple[bool, Optional[str]]:
        """
        Try to build and save a COF from its name string.
        Returns (success, error_message_or_None).
        """
        try:
            cof = pcb.Framework(cof_name, out_dir=self.out_dir, save_bb=False, log_level="warning")
            cof.save(fmt=fmt, supercell=list(supercell), save_dir=self.out_dir)
            return True, None
        except Exception as e:
            return False, str(e)

    def batch_generate(
        self,
        n_structures: int = 20,
        max_attempts: Optional[int] = None,
        fmt: str = "cif",
        supercell: Tuple[int, int, int] = (1, 1, 1),
        topology: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Generate many random COFs, robustly:
        - Keep sampling until we get n_structures successes or hit max_attempts.
        - Log name, success/failure, error message.

        Returns:
            pandas.DataFrame with columns:
                ['cof_name', 'topology', 'status', 'error']
        """
        if max_attempts is None:
            max_attempts = n_structures * 10

        records = []
        n_success = 0
        attempts = 0

        print(
            f">>> Starting batch generation: target={n_structures}, "
            f"max_attempts={max_attempts}"
        )

        start_time = time.time()

        while n_success < n_structures and attempts < max_attempts:
            attempts += 1

            try:
                cof_name = self.random_cof_name(topology=topology)
                topo = cof_name.split("-")[2]
            except Exception as e:
                records.append(
                    {
                        "cof_name": None,
                        "topology": topology,
                        "status": "name_error",
                        "error": str(e),
                    }
                )
                continue

            ok, err = self.try_build_and_save(cof_name, fmt=fmt, supercell=supercell)
            if ok:
                print(f"Structure num: {n_success}")
                n_success += 1
                status = "ok"
            else:
                status = "error"

            records.append(
                {
                    "cof_name": cof_name,
                    "topology": topo,
                    "status": status,
                    "error": err,
                }
            )

            if attempts % 10 == 0:
                print(f"  Attempts: {attempts} | Successes: {n_success}")

        elapsed = time.time() - start_time
        print(
            f">>> Done. Successes: {n_success}/{n_structures} "
            f"in {attempts} attempts (elapsed {elapsed:.1f} s)"
        )

        df = pd.DataFrame(records)
        return df


# ============================
# MAIN EXECUTION EXAMPLE
# ============================

if __name__ == "__main__":
    # You can tweak these values freely
    N_STRUCTURES = 30
    OUTPUT_DIR = "generated_cofs"
    RANDOM_SEED = 42

    generator = COFGenerator(
        L2_cores=L2_CORES,
        T3_cores=T3_CORES,
        S4_cores=S4_CORES,
        H6_cores=H6_CORES,
        q_connectors=Q_CONNECTORS,
        r_groups=R_GROUPS,
        out_dir=OUTPUT_DIR,
        seed=RANDOM_SEED,
    )

    # Example: mix of HCB and SQL (topology=None → randomly chooses)
    df_log = generator.batch_generate(
        n_structures=N_STRUCTURES,
        max_attempts=N_STRUCTURES * 10,
        fmt="cif",
        supercell=(1, 1, 1),
        topology=None,  # or "HCB" or "SQL" if you want to force one
    )

    # Save a CSV report of what happened
    log_path = os.path.join(OUTPUT_DIR, "generation_log.csv")
    df_log.to_csv(log_path, index=False)
    print(f">>> Log saved to {log_path}")
    print(df_log.head())
