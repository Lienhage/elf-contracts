import { expect } from "chai";
import { Signer } from "ethers";
import { ethers, waffle } from "hardhat";
import { ZapCurveTokenToPrincipalToken } from "typechain/ZapCurveTokenToPrincipalToken";
import { ZERO } from "./helpers/constants";
import {
  ConstructZapInArgs,
  ConstructZapOutArgs,
  deploy,
} from "./helpers/deployZapCurveTokenToPrincipalToken";
import { calcBigNumberPercentage } from "./helpers/math";
import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import {
  ePyvcrv3crypto,
  ePyvcrvSTETH,
  ePyvCurveLUSD,
  getERC20,
  getPrincipalToken,
} from "./helpers/ZapCurveTries";
const { provider } = waffle;

const ptOffsetTolerancePercentage = 0.1;

describe.only("ZapCurveTokenToPrincpalToken", () => {
  let users: { user: Signer; address: string }[];

  let zapCurveTokenToPrincipalToken: ZapCurveTokenToPrincipalToken;
  let constructZapInArgs: ConstructZapInArgs;
  let constructZapOutArgs: ConstructZapOutArgs;

  before(async () => {
    await createSnapshot(provider);

    users = ((await ethers.getSigners()) as Signer[]).map((user) => ({
      user,
      address: "",
    }));

    await Promise.all(
      users.map(async (userInfo) => {
        const { user } = userInfo;
        userInfo.address = await user.getAddress();
      })
    );

    ({
      zapCurveTokenToPrincipalToken,
      constructZapInArgs,
      constructZapOutArgs,
    } = await deploy(users[1]));
  });

  after(async () => {
    await restoreSnapshot(provider);
  });

  beforeEach(async () => {
    await createSnapshot(provider);
  });
  afterEach(async () => {
    await restoreSnapshot(provider);
  });

  describe("ETH:STETH <-> ePyvcrvSTETH", () => {
    it("should swap ETH for ePyvcrvSTETH", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrvSTETH, {
          ETH: ethers.utils.parseEther("1"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps, {
          value: ethers.utils.parseEther("1"),
        });
      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrvSTETH"
      ).balanceOf(users[1].address);
      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvcrvSTETH to ETH", async () => {
      const principalTokenAmount = ethers.utils.parseEther("100");

      const user2PreBalance = await provider.getBalance(users[2].address);
      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(
          ePyvcrvSTETH,
          "ETH",
          principalTokenAmount,
          users[2].address
        );

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatEther(expectedRootTokenAmount)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const user2PostBalance = await provider.getBalance(users[2].address);

      const returnedTokenAmount = user2PostBalance.sub(user2PreBalance);

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatEther(returnedTokenAmount));
    });

    it("should swap stETH for ePyvcrvSTETH", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrvSTETH, {
          stETH: ethers.utils.parseEther("100"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrvSTETH"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvcrvSTETH to stETH", async () => {
      const principalTokenAmount = ethers.utils.parseEther("100");
      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(ePyvcrvSTETH, "stETH", principalTokenAmount);

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatEther(expectedRootTokenAmount)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("stETH").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatEther(returnedTokenAmount));
    });

    it("should swap stETH & ETH for ePyvcrvSTETH", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrvSTETH, {
          ETH: ethers.utils.parseEther("100"),
          stETH: ethers.utils.parseEther("100"),
        });
      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps, {
          value: ethers.utils.parseEther("100"),
        });

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrvSTETH"
      ).balanceOf(users[1].address);
      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });
  });

  describe("USDT:WBTC:WETH <-> ePyvcrv3crypto", () => {
    it("should swap USDT for ePyvcrv3crypto", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrv3crypto, {
          USDT: ethers.utils.parseUnits("5000", 6),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrv3crypto"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );

      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );

      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvcrv3crypto to USDT", async () => {
      const principalTokenAmount = ethers.utils.parseEther("10");

      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(ePyvcrv3crypto, "USDT", principalTokenAmount);

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatUnits(expectedRootTokenAmount, 6)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("USDT").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatUnits(returnedTokenAmount, 6));
    });

    it("should swap WBTC for ePyvcrv3crypto", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrv3crypto, {
          WBTC: ethers.utils.parseUnits("0.2", 8),
        });
      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrv3crypto"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvcrv3crypto to WBTC", async () => {
      const principalTokenAmount = ethers.utils.parseEther("10");

      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(ePyvcrv3crypto, "WBTC", principalTokenAmount);

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatUnits(expectedRootTokenAmount, 8)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("WBTC").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatUnits(returnedTokenAmount, 8));
    });

    it("should swap WETH for ePyvcrv3crypto", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrv3crypto, {
          WETH: ethers.utils.parseEther("2"),
        });
      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrv3crypto"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvcrv3crypto to WETH", async () => {
      const principalTokenAmount = ethers.utils.parseEther("10");

      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(ePyvcrv3crypto, "WETH", principalTokenAmount);

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatEther(expectedRootTokenAmount)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("WETH").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatEther(returnedTokenAmount));
    });

    it("should swap WBTC,USDT & WETH for ePyvcrv3crypto", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvcrv3crypto, {
          WETH: ethers.utils.parseEther("2"),
          WBTC: ethers.utils.parseUnits("0.2", 8),
          USDT: ethers.utils.parseUnits("5000", 6),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvcrv3crypto"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        1
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });
  });

  describe("LUSD:3Crv:DAI:USDC:USDT <-> ePyvCurveLUSD", () => {
    it("should swap DAI for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          DAI: ethers.utils.parseEther("5000"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvCurveLUSD to DAI", async () => {
      const principalTokenAmount = ethers.utils.parseEther("5000");

      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(ePyvCurveLUSD, "DAI", principalTokenAmount);

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatEther(expectedRootTokenAmount)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("DAI").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatEther(returnedTokenAmount));
    });

    it("should swap USDC for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          USDC: ethers.utils.parseUnits("5000", 6),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it.only("should swap ePyvCurveLUSD to USDC", async () => {
      const principalTokenAmount = ethers.utils.parseEther("5000");

      const { info, zap, childZap, expectedRootTokenAmount } =
        await constructZapOutArgs(ePyvCurveLUSD, "USDC", principalTokenAmount);

      console.log(
        "Expected RootToken Amount:",
        ethers.utils.formatEther(expectedRootTokenAmount)
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("USDC").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatUnits(returnedTokenAmount, 6));
    });

    it("should swap USDT for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          USDT: ethers.utils.parseUnits("5000", 6),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvCurveLUSD to USDT", async () => {
      const principalTokenAmount = ethers.utils.parseEther("5000");

      const { info, zap, childZap } = await constructZapOutArgs(
        ePyvCurveLUSD,
        "USDT",
        principalTokenAmount
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("USDT").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatUnits(returnedTokenAmount, 6));
    });

    it("should swap LUSD for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          LUSD: ethers.utils.parseEther("5000"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvCurveLUSD to LUSD", async () => {
      const principalTokenAmount = ethers.utils.parseEther("5000");

      const { info, zap, childZap } = await constructZapOutArgs(
        ePyvCurveLUSD,
        "LUSD",
        principalTokenAmount
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("LUSD").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatEther(returnedTokenAmount));
    });

    it("should swap 3Crv for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          ["3Crv"]: ethers.utils.parseEther("5000"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap ePyvCurveLUSD to 3Crv", async () => {
      const principalTokenAmount = ethers.utils.parseEther("5000");

      const { info, zap, childZap } = await constructZapOutArgs(
        ePyvCurveLUSD,
        "3Crv",
        principalTokenAmount
      );

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveOut(info, zap, childZap);

      const returnedTokenAmount = await getERC20("3Crv").balanceOf(
        users[1].address
      );

      console.log(ethers.utils.formatEther(principalTokenAmount));
      console.log(ethers.utils.formatEther(returnedTokenAmount));
    });

    it("should swap LUSD and DAI for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          LUSD: ethers.utils.parseEther("5000"),
          DAI: ethers.utils.parseEther("5000"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap 3Crv and DAI for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          ["3Crv"]: ethers.utils.parseEther("5000"),
          DAI: ethers.utils.parseEther("5000"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });

    it("should swap LUSD, DAI, USDC, USDT & ThreeCrv for ePyvCurveLUSD", async () => {
      const { info, zap, childZaps, expectedPrincipalTokenAmount } =
        await constructZapInArgs(ePyvCurveLUSD, {
          ["3Crv"]: ethers.utils.parseEther("5000"),
          DAI: ethers.utils.parseEther("5000"),
          USDC: ethers.utils.parseUnits("5000", 6),
          USDT: ethers.utils.parseUnits("5000", 6),
          LUSD: ethers.utils.parseEther("5000"),
        });

      await zapCurveTokenToPrincipalToken
        .connect(users[1].user)
        .zapCurveIn(info, zap, childZaps);

      const returnedPrincipalTokenAmount = await getPrincipalToken(
        "ePyvCurveLUSD"
      ).balanceOf(users[1].address);

      const diff = returnedPrincipalTokenAmount.sub(
        expectedPrincipalTokenAmount
      );
      const allowedOffset = calcBigNumberPercentage(
        returnedPrincipalTokenAmount,
        ptOffsetTolerancePercentage
      );
      expect(diff.gte(ZERO)).to.be.true;
      expect(diff.lt(allowedOffset)).to.be.true;
    });
  });
});