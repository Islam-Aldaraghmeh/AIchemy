Problem Statement
Covalent organic frameworks (COFs) are a rapidly developing class of porous, crystalline polymers
with modular “dial-a-property” chemistry. Their tunability identifies them as strong candidates for
desalination membranes, hydrogen storage and purification, CO2 capture, and electrochemical catalysis—
domains that directly support Saudi Vision 2030, especially through projects such as the NEOM Green
Hydrogen Company, Aramco’s DAC pilot, and large-scale water initiatives like Rabigh 3 IWP.
However, transforming COFs from theoretical solutions into field-ready materials remains slow, expensive,
and highly uncertain to perform well under real-world environment conditions. When a scientist
is provided with a specific operating environment—such as high-salinity brine, mixed-acid gas
streams, humid coastal air, or inland high-temperature conditions—there exists no reliable, chemistrydriven
method for generating a suitable COF structure tailored to that environment and the required
key performance indicators (KPIs) (e.g., selectivity, flux, stability, working capacity, durability).
Instead, the current workflow is governed by trial-and-error. Researchers manually guess which
linkage chemistry might survive the target conditions, select monomers and functional groups, choose a
topology, and then screen dozens to hundreds of candidate structures through simulations and synthesis
attempts. When a chosen COFs fails under real-world conditions–heat, humidity, impurities, and pH
swings–the cycle restarts; because COFs hold the property–structure relationship, it is one-to-many,
meaning that the same target property profile can be achieved by multiple distinct structures. Even
leading Saudi R&D programs (KFUPM IRC-HTCM and Aramco’s Carbon Management R&D Program)
report high attrition between computationally promising COFs and those that survive deployment:
• For a single application, teams routinely examine 50–150 COF structures before identifying 1–2
viable candidates.
• Pre-simulation triage alone consumes weeks to months due to manual structure selection.
• Failed hypotheses account for more than 80–90% of total screening time.
• Most failures are not due to simulation inaccuracies, but to the absence of an upstream, environmentaware
chemistry recommender.
Thus, the scope of the problem is that: there is currently no generative system capable of taking
an environment plus performance targets and producing a small, scientifically plausible set of COF
structures—complete with linkages, monomers, functional groups, and topology—prior to heavy computation
or laboratory work such as density functional theory (DFT) and molecular dynamics in which they
do suffer from: (1) computationally expensive; (2) they do cover small subspace of all possible outcomes.
The lack of such a system forces reliance on human intuition biased toward familiar chemistries, slows
discovery by an order of magnitude, and leads to costly mismatches between lab-screened COFs and
those that survive real Saudi deployment conditions.
1