L2_CORES = ['BENZ', 'TPTA', 'TRZN', 'DICZ', 'TPAM', 'TPOB', 'DBA1', 'TPNY', 'BRZN', 'TPTZ', 'BTTP', 'TPBZ']
T3_CORES = ['BENZ', 'TPB', 'TRZN', 'HBC', 'PYRE', 'TRUX', 'TPA', 'BTP', 'DTP', 'HAT'] 
S4_CORES = ['PORP', 'PYRE', 'PHPR']
H6_CORES = ['HPCO', 'HECO']

l2_list = ['BENZ', 'DBA1', 'TPTA', 'TRZN', 'DICZ', 'TPAM', 'TPOB', 'TBBZ', 'DBA2', 'TPNY', 'BRZN', 'TPTZ', 'BTTP', 'TPBZ', 'STAR', 'STAR1']
t3_list = ['PHEN', 'BENZ', 'HDZN', 'PYEN', 'INFL', 'NAPT', 'PTCD', '4IDT', 'BBTZ', 'DPEL', 'TIDA', 'DHPI', 'DPBY', 'PYTO', 'TIEN', 'DFFE', 'ANTR', '2BPD', 'DHSI', '3BPD', 'INTO', 'TPNY', 'BDTP', 'PYRN', 'BPYB', 'NDTP', 'INDE', 'DPDA', 'BDFN', 'IITT', 'BTPH', 'DPEY', '3IDT', 'BPNY', 'TPDI', 'TTPH']
s4_list = ['PTCA', 'PHPR', 'PORP']
h6_list = ['HPCO', 'HECO']
q_list = ['COOH', 'NHOH', 'NHNH2', 'Cl', 'CONHNH2', 'Br', 'CHO', 'BOH2', 'COCHCHOH', 'NH2', 'O', 'CHCN']
r_list = ['COOH', 'F', 'Cl', 'OCOCH3', 'Ph', 'Br', 'NO', 'SH', 'CH3', 'OEt', 'EEPO', 'CN', 'tBu', 'SO3H', 'CHS', 'I', 'NO2', 'CHO', 'H', 'EMEPO', 'DMPE', 'MEPO', 'OProp', 'OEEPO', 'EPO', 'NH2', 'SO2H', 'O', 'OMe', 'OH']


print(set(L2_CORES)-set(l2_list))
print(set(T3_CORES)-set(t3_list))
print(set(S4_CORES)-set(s4_list))
print(set(H6_CORES)-set(h6_list))

"S4_PHPR_NH2_H-L2_BTTP_CHO_Ph-SQL_A-AA"