Three blockers, all in the dispute path, and I confirmed each with a failing Foundry test. There is no spec or decisions attachment in the message, so I read specs/contract.md and specs/00-decisions.md from the repo. I did not modify HeirloomRegistry.sol.



I added contracts/test/ReviewPoC.t.sol with the three failing tests. It breaks forge test until you delete it or fix the blockers.



Blockers



B1 · blocker · dispute :356, attest :345, ReleaseRule.evaluate :67-75 · §5.5, §10 "one guardian blocks forever", D3/D4 "kDispute always reachable"

The dispute override cannot be reached in two ordinary configurations. One guardian therefore blocks release until the owner's next heartbeat, and the owner is dead in this scenario.

\- (a) The disputer abstains. D3 allows kAttest = n-1, so kDispute = n. The override needs all n guardians to attest after disputedAt, including the disputer, who just voted ALIVE. If that guardian simply never attests, the count tops out at n-1. D3's "≤ n" bound is numerically against an adversarialguardian. Either cap kAttest ≤ n-2 or exclude the disputer from the count and cap

&#x20; kDispute ≤ n-1.

\- (b) D5 locks pre-dispute attesters out of "fresh". A guardian who attested DECEASED

&#x20; with a non-zero hash canno5 reverts, and at stays older than disputedAt, so it never counts. Only guardians who have not attested, or have

&#x20; not yet used their one upg5, k=3 and the threeattesters locked, at most 2 fresh attestations are possible against kDispute = 4.

&#x20; This is the normal state fcause every attester carriesa hash.



solidity

// B1a: one abstaining dispu

function test\_B1a() public {

&#x20;   \_add(ASSET, \_pol(0x06, 4

&#x20;   \_at(\_now() + 1);  \_disp(4);  \_at(\_now() + 1);

&#x20;   for (uint256 i; i < 4; +0);

&#x20;   \_at(\_now() + 10\_000);

&#x20;   assertTrue(\_rel(ASSET));

}

// B1b: locked attesters can

function test\_B1b() public {                                                             \_add(ASSET, \_pol(0x06, 3

&#x20;   \_at(\_now() + 1);                                                                     for (uint256 i; i < 3; +A1);

&#x20;   \_at(\_now() + 1);  \_disp(3);  \_at(\_now() + 1);                                        vm.expectRevert(R.Attest

&#x20;   \_att(0, Reason.DECEASED, A1);                                                        \_att(3, Reason.DECEASED,D, A1);

&#x20;   \_at(\_now() + 10\_000);                                                                assertTrue(\_rel(ASSET));

}                                                                                    

B2 · blocker · dispute :359, ReleaseRule.evaluate :80 · §5.4 (no Releasable→Disputed edge), D8 "a release cannot

dispute() has no "already releasable" or "already claimed" guard, and the dispute   check is evaluated lazily ind after the window elapsesflips a Releasable asset back to false. That blocks the remaining submitShare calls and markClaimed. Combined wi latching release, forexample storing a releasedAt the first time a successful submitShare observes isReleasable, or by rejectineleasable.



solidity

function test\_B2() public {

&#x20;   \_stdAsset(ASSET);  \_rele= true

&#x20;   \_disp(4);

&#x20;   assertTrue(\_rel(ASSET));

}



B3 · should-fix, escalate if you want parity with B2 · attest :349 · D5/D8

D5 resets at on an upgrade. first k attesters, tQuorummoves later. So after the window has elapsed, one quorum member can upgrade (raise tDECEASED, or add evidence) a is up to two window restarts per guardian per epoch, and it is not blocked by anything once shares are in flight.D5 mandates the reset, so ththan a coding error. Resolveit with the same latch as B2, or compute tQuorum from first-filed times and use the reset at only for the overri

&#x20;                                                                                   Should-fix

&#x20;                                                                                   S1 · submitShare :381-385 ·

It does not check claimed, and it overwrites shares\[asset]\[claimant]\[g]             unconditionally. A malicious share with any 113 bytesafter the claimant has fetched it, or after markClaimed. This is attributable througthe commitment mismatch but te once per slot, or block it after claimed.                                                                      

S2 · addAsset :265 · item 1                                                         reasonsMask > 0x0e still acc01, 0x03, ...). Mask 0x01 isaccepted and can never release, since NONE is filtered. Reject reasonsMask \& 1.     

S3 · constructor :148 · item 1, D7                                                  TIME\_UNIT is unbounded. At a timeUnit at ReleaseRule :48overflows (checked), and isReleasable, submitShare and markClaimed all revert. Add aupper bound at deploy.

&#x20;                                                                                   S4 · createVault :237-244 ·

A bytes32(0) guardian is accepted. It can never authenticate, because keyId is never0, so it silently shrinks th It also makescontingentBenef == 0 revert BeneficiaryIsGuardian at :271. Reject zero guardians. Thowner key and benefactor keys or as beneficiaries; thespec only forbids beneficiary ∈ guardians, so I am noting it rather than flagging it

S5 · addAsset :264-268 · I2                                                         window == 0 and claimDeadlindow == 0, release happens attOpen with no cooling period, which contradicts the "elapsed window" in I2. This is the owner's own foot-gun, soe invariant enforced.



Notes

&#x20;                                                                                    N1 · dispute scope. The co vault per epoch (:359), notone per guardian (§5.5 wording). It stores no disputer identity, so excluding the  disputer (B1 fix) needs a ian disputes would be worse,because each would move disputedAt.                                                N2 · same-timestamp attestt == disputedAt (same block,after the dispute) does not count (:70, strict >). That matches D4.                N3 · day-granular heartbea:213), so tSilence can arrive up to TIME\_UNIT - 1 seconds before heartbeat + minInactivity. With minInactivity = 1 and a heartbeat at 23:59d later. That is the D7/§6.1intent, but minInactivity is not a hard lower bound.                               N4 · setAbsence and signats no upper bound (:300) andis never cleared by a later beat. It is owner-only, but a stolen device can set it to 2^40-1. Separately, a h deadline) can be replayed by any relayer later in nonce order. Nonces are strictly sequential and there is no cancel path.

\- N5 · markClaimed and stubs. markClaimed does not require any shares to have been

&#x20; submitted (:399-407). ThatclaimContingent exists aprimary can close the asset without ever receiving shares. When the Phase 7 stubs

&#x20; land, queueChange, applyCh claimContingent must gothrough \_beat. I could not review them, since they only revert.

\- N6 · createVault vault id.+ 1. A front-run createinvalidates the signature (BadAuth) without burning the nonce, because the whole

&#x20; transaction reverts.



Access-control matrix (verif



┌────────────────────────────────────────┬──────────┐

│                Function                 │       Who can call        │ Checked  │

│                                        │    at    │

├─────────────────────────────────────────┼───────────────────────────┼──────────┤

│ createVault               ut must      │ :238     │

│                                         │ equal owners\[0] ≠ 0       │          │

├────────────────────────────────────────┼──────────┤

│ addAsset, heartbeat, cancel, setAbsence │ owners\[0] or owners\[1]    │ :187     │

├────────────────────────────────────────┼──────────┤

│ attest, dispute, submitShare            │ Guardian (linear scan ≤   │ :188-196 │

│                                        │          │

├─────────────────────────────────────────┼───────────────────────────┼──────────┤

│ markClaimed               Benef        │ :404     │

├─────────────────────────────────────────┼───────────────────────────┼──────────┤

│ queueChange, applyChange, plemented)   │ stubs    │

│  rekey, drill, claimContingent          │                           │          │

├────────────────────────────────────────┼──────────┤

│ keyId, isReleasable, currentClaimant,   │ Anyone (views)            │ n/a      │

│ status, timeline, nonces,              │          │

└─────────────────────────────────────────┴───────────────────────────┴──────────┘



Checked, no defect found



\- Comparisons. Release uses >= at :80 as in §5.2. status uses >= for silence and for

&#x20; ContingentEligible, consiside uses a strict > as in D4.

\- Overflow and casts. All arithmetic runs in uint256 as D7 requires. The

&#x20; uint40(block.timestamp / Tar 36812.

\- Epoch. createVault, addAsset, heartbeat, cancel and setAbsence all call \_beat.

&#x20; Attestations are keyed attre scoped by disputeEpoch ==epoch. absentUntil, claimed and shares persist, which is intended.

\- Quorum computation. The k-estations, and the D6 pairing loop (shared non-zero hash among valid attesters), are correct. Ties do not change tQuorum.

\- Attestation upgrade (D5). The :345 predicate allows raise and add-evidence only, rejects downgrade, MISSINGr removal, and no-opre-attests, so there is no at refresh by spamming.

\- Auth and replay. The digesvia the OZ EIP712 domain,plus vaultId, action, paramsHash, nonce and deadline. The nonce is per keyId. OZ tryRecover rejects high-s  cannot pass. A failedsignature rolls back the nonce increment. DIRECT does not touch nonces, and the shared keyId cannot cross ds vaultId.

\- Loops and storage. Every loop is bounded by n ≤ 12. shares is bounded by (asset, one claimant, n guardians). Vaaller.

\- status vs isReleasable. They are consistent. A dispute with no quorum is hidden as Sealed/Silent, which match

