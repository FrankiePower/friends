"use client";
import Link from "next/link";
import { ConnectedAddress } from "~~/components/ConnectedAddress";
import { useState, useRef } from "react";
import { Users, Target, Shield, Zap, Plus, Share2, Heart, Star, Trophy } from "lucide-react";
import { useAccount } from "@starknet-react/core";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-stark/useScaffoldWriteContract";
import { useScaffoldReadContract } from "~~/hooks/scaffold-stark/useScaffoldReadContract";
import { formatUnits } from "ethers";

// Types
interface Contributor {
  name: string;
  amount: number;
  avatar: string;
  color: string;
}

interface Goal {
  id: number;
  title: string;
  description: string;
  target: number;
  current: number;
  contributors: Contributor[];
  organizer: string;
  daysLeft: number;
  gradient: string;
}

// Helper to format recipient as hex
const formatRecipient = (val: string | number) => {
  if (!val) return "0x0";
  if (typeof val === "string" && val.startsWith("0x")) return val;
  return `0x${BigInt(val).toString(16)}`;
};

// Helper to format big numbers
const formatBig = (val: string | number) => {
  try {
    return BigInt(val).toLocaleString();
  } catch {
    return String(val);
  }
};

// Helper to format STRK values (wei to STRK)
const formatStrkAmount = (val: string | number | bigint) => {
  try {
    return parseFloat(formatUnits(BigInt(val), 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return String(val);
  }
};

const Home = () => {
  const [activeView, setActiveView] = useState("landing");
  const [poolIdInput, setPoolIdInput] = useState("");
  const [poolIdToFetch, setPoolIdToFetch] = useState<number | undefined>(undefined);
  const [contributionAmount, setContributionAmount] = useState("0.0");

  const { data: fetchedPool, isLoading: isPoolLoading, error: poolError } = useScaffoldReadContract({
    contractName: "Pooler",
    functionName: "get_pool",
    args: poolIdToFetch !== undefined ? [poolIdToFetch] : undefined,
    enabled: poolIdToFetch !== undefined,
  });

  const { sendAsync, isPending: isContributing, error: contributeError } = useScaffoldWriteContract({
    contractName: "Pooler",
    functionName: "contribute",
    args: [poolIdToFetch || 0n, BigInt(Number(contributionAmount) * 10 ** 18)], // Convert ETH to STRK (18 decimals)
  });

  const handleFetchPool = () => {
    if (!poolIdInput.match(/^\d+$/)) return;
    setPoolIdToFetch(Number(poolIdInput));
  };

  const handleContribute = async () => {
    if (!poolIdToFetch) return;
    setContributionAmount("0.0"); // Reset input
    try {
      await sendAsync();
    } catch (err) {
      console.error(err);
    }
  };

  const features = [
    {
      icon: <Target className="h-8 w-8 text-white" />,
      title: "Set Group Goals",
      description: "Create shared savings targets for group activities.",
      gradient: "from-pink-500 to-rose-500",
      delay: "stagger-delay-1",
    },
    {
      icon: <Users className="h-8 w-8 text-white" />,
      title: "Invite Friends",
      description: "Share your goal with friends to contribute securely.",
      gradient: "from-blue-500 to-cyan-500",
      delay: "stagger-delay-2",
    },
    {
      icon: <Shield className="h-8 w-8 text-white" />,
      title: "Secure & Transparent",
      description: "Smart contracts ensure funds are safely locked.",
      gradient: "from-emerald-500 to-teal-500",
      delay: "stagger-delay-3",
    },
    {
      icon: <Zap className="h-8 w-8 text-white" />,
      title: "Instant Release",
      description: "Funds are released automatically when target is met.",
      gradient: "from-yellow-500 to-orange-500",
      delay: "stagger-delay-4",
    },
  ];

  const modalRef = useRef<HTMLDialogElement>(null);

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const progressPercentage = Math.min((goal.current / goal.target) * 100, 100);
    const isCompleted = progressPercentage >= 100;

    return (
      <div className="card bg-base-100 shadow-xl hover:scale-105 transition-all duration-500 relative overflow-hidden group">
        <div className={`absolute inset-0 bg-gradient-to-br ${goal.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
        <div className="card-body">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="card-title text-xl font-bold text-gray-800 mb-2">
                <span className="inline-block emoji-wiggle">{goal.title.split(" ").pop()}</span>{" "}
                {goal.title.replace(goal.title.split(" ").pop() || "", "")}
              </h2>
              <p className="text-sm opacity-70">{goal.description}</p>
            </div>
            <div className={`badge ml-2 ${isCompleted ? "badge-success animate-pulse" : "badge-secondary animate-bounce"}`}>
              {isCompleted ? (
                <>
                  <Trophy className="w-3 h-3 mr-1" /> Complete!
                </>
              ) : (
                `${goal.daysLeft} days left`
              )}
            </div>
          </div>
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex justify-between text-sm font-medium mb-2">
                <span className="text-gray-700">${goal.current} raised</span>
                <span className="text-gray-500">${goal.target} goal</span>
              </div>
              <div className="relative">
                <progress className={`progress progress-primary w-full h-4 ${isCompleted ? "animate-pulse" : ""}`} value={progressPercentage} max="100"></progress>
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${goal.gradient} opacity-80 rounded-full`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center">
                {Math.round(progressPercentage)}% complete
                {isCompleted && <Heart className="w-3 h-3 ml-1 text-red-500 animate-bounce" />}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                Contributors ({goal.contributors.length}) <Star className="w-4 h-4 ml-1 text-yellow-500" />
              </p>
              <div className="flex space-x-3">
                {goal.contributors.map((contributor, index) => (
                  <div key={index} className="flex flex-col items-center space-y-1 group/contributor">
                    <div
                      className={`w-10 h-10 bg-gradient-to-r ${contributor.color} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg group-hover/contributor:scale-110 transition-transform animate-bounce`}
                      style={{ animationDelay: `${index * 0.5}s` }}
                    >
                      {contributor.avatar}
                    </div>
                    <span className="text-xs text-gray-600 font-medium">${contributor.amount}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex space-x-2 pt-2">
              <button className={`btn btn-primary flex-1 bg-gradient-to-r ${goal.gradient} text-white border-0`}>
                <Heart className="w-4 h-4 mr-2" /> Contribute
              </button>
              <button className="btn btn-outline flex-1 border-2 border-purple-300">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CreateGoalDialog = () => {
    const [newGoal, setNewGoal] = useState({ title: "", description: "", target: "", emoji: "🎯" });
    const emojiOptions = ["🎵", "🏖️", "🎬", "🍕", "🎯", "🚗", "🏠", "🎉", "💰", "🎁", "🌟", "🦄"];
    const { address: accountAddress } = useAccount();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { sendAsync, isPending } = useScaffoldWriteContract({
      contractName: "Pooler",
      functionName: "create_pool",
      args: [newGoal.description, { low: Number(newGoal.target), high: 0 }, accountAddress || "0x0"],
    });

    const handleCreateGoal = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        await sendAsync();
        setNewGoal({ title: "", description: "", target: "", emoji: "🎯" });
        modalRef.current?.close();
      } catch (err) {
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <>
        <button
          className="btn bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white px-8 py-4 rounded-full font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all btn-fun animate-gradient-x"
          onClick={() => modalRef.current?.showModal()}
        >
          <Plus className="w-5 h-5 mr-2" /> Create New Goal
        </button>
        <dialog ref={modalRef} className="modal">
          <form method="dialog" className="modal-box glass-effect border-2 border-purple-200" onSubmit={handleCreateGoal}>
            <h3 className="font-bold text-2xl text-gradient-rainbow mb-2">Create a New Savings Goal</h3>
            <p className="text-gray-600 mb-4">Set up a shared savings target and invite your friends.</p>
            <div className="space-y-4 py-4">
              <div>
                <label className="label font-semibold text-gray-700">Choose an Emoji</label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewGoal({ ...newGoal, emoji })}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl hover:scale-125 transition-all emoji-wiggle ${
                        newGoal.emoji === emoji ? "border-purple-500 bg-gradient-to-r from-purple-100 to-pink-100 animate-pulse" : "border-gray-200 hover:border-purple-300 glass-effect"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label font-semibold text-gray-700">Goal Title</label>
                <input
                  className="input input-bordered w-full border-2 focus:border-purple-400 text-gray-900"
                  placeholder="e.g., Concert tickets, Weekend trip..."
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label font-semibold text-gray-700">Description</label>
                <textarea
                  className="textarea textarea-bordered w-full border-2 focus:border-purple-400 text-gray-900"
                  placeholder="Tell your friends what this goal is for..."
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                />
              </div>
              <div>
                <label className="label font-semibold text-gray-700">Target Amount ($)</label>
                <input
                  type="number"
                  className="input input-bordered w-full border-2 focus:border-purple-400 text-gray-900"
                  placeholder="500"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all btn-fun"
                disabled={isPending || isSubmitting}
              >
                {isPending || isSubmitting ? (
                  "Creating..."
                ) : (
                  <>
                    <Star className="w-4 h-4 mr-2" /> Create Goal & Invite Friends
                  </>
                )}
              </button>
            </div>
            <div className="modal-action">
              <button className="btn" type="button" onClick={() => modalRef.current?.close()}>
                Close
              </button>
            </div>
          </form>
        </dialog>
      </>
    );
  };

  if (activeView === "goals") {
    return (
      <div className="min-h-screen fun-bg">
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div className="stagger-animation">
              <h1 className="text-4xl font-bold text-gradient-rainbow mb-2">Your Goals</h1>
              <p className="text-gray-700 text-lg">Track your group savings progress</p>
            </div>
            <div className="flex space-x-4 stagger-animation stagger-delay-1">
              <button
                className="btn btn-outline glass-effect border-2 border-white/30 hover:border-purple-300 hover:scale-105 transition-all"
                onClick={() => setActiveView("landing")}
              >
                Back to Home
              </button>
              <CreateGoalDialog />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen fun-bg">
      <section className="container mx-auto px-4 py-16 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight stagger-animation">
            Save Together, <span className="text-gradient-rainbow animate-gradient-x">Dream Together</span>
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed stagger-animation stagger-delay-1">
            Friends makes group savings fun and secure. Create shared goals and watch your dreams become reality! ✨
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center stagger-animation stagger-delay-2">
            <CreateGoalDialog />
          </div>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-12 stagger-animation">
          <h2 className="text-4xl font-bold text-gradient-rainbow mb-4">How Friends Works</h2>
          <p className="text-gray-700 max-w-2xl mx-auto text-lg">Simple, secure, and social group savings! 🚀</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`card text-center shadow-xl glass-effect hover:shadow-2xl transition-all hover:scale-105 animate-float-delayed stagger-animation ${feature.delay}`}
            >
              <div className={`mx-auto mb-4 p-4 rounded-full bg-gradient-to-r ${feature.gradient} shadow-xl w-fit animate-bounce`}>
                {feature.icon}
              </div>
              <div className="card-body">
                <h2 className="card-title text-xl font-bold text-gray-800">{feature.title}</h2>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-12 stagger-animation">
          <h2 className="text-4xl font-bold text-gradient-rainbow mb-4">Active Goals</h2>
          <p className="text-gray-700 text-lg">Fetch a goal by Pool ID 🎯</p>
        </div>
        <div className="flex items-center gap-2 justify-center mb-6">
          <input
            className="input input-bordered w-32"
            type="number"
            placeholder="Pool ID"
            value={poolIdInput}
            onChange={(e) => setPoolIdInput(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleFetchPool}>
            Fetch Pool
          </button>
          {poolError && <span className="text-red-500 ml-2">{String(poolError)}</span>}
        </div>
        {isPoolLoading && <div className="text-center">Loading...</div>}
        {fetchedPool && (
          <div className="card bg-base-100 shadow-xl hover:scale-105 transition-all duration-500 relative overflow-hidden group max-w-xl mx-auto my-6">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600 opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="card-body">
              <div className="flex justify-between items-center mb-2">
                <h2 className="card-title text-2xl font-bold text-gray-800">
                  <span className="inline-block emoji-wiggle">🎯</span> {fetchedPool[0]}
                </h2>
                <div className={`badge ml-2 ${fetchedPool[4] ? "badge-success animate-pulse" : "badge-secondary animate-bounce"}`}>
                  {fetchedPool[4] ? (
                    <>
                      <Trophy className="w-3 h-3 mr-1" /> Complete!
                    </>
                  ) : (
                    "Active"
                  )}
                </div>
              </div>
              <div className="mb-2 text-gray-700 text-lg font-medium">
                Target: <span className="text-purple-700">Ξ {fetchedPool[1]}</span>
              </div>
              <div className="mb-2 text-gray-700 text-lg font-medium">
                Current: <span className="text-blue-700">Ξ {formatStrkAmount(fetchedPool[3])}</span>
              </div>
              <div className="mb-2 text-gray-700 text-sm">
                Recipient: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{formatRecipient(fetchedPool[2])}</span>
              </div>
           
            </div>
          </div>
        )}
      </section>
      <section className="container mx-auto px-4 py-8">
        {fetchedPool && (
          <div className="max-w-xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-6">Contribute to Pool #{poolIdToFetch}</h3>
            <div className="card bg-base-100 shadow-xl p-6">
              <div className="flex flex-col gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Contribution Amount (STRK)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="input input-bordered"
                    min="0"
                    step="0.01"
                    value={contributionAmount}
                    onChange={e => setContributionAmount(e.target.value)}
                    disabled={fetchedPool[4] || isContributing}
                  />
                </div>
                <button 
                  className="btn btn-primary bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white border-0"
                  disabled={fetchedPool[4] || isContributing}
                  onClick={handleContribute}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  {isContributing ? "Contributing..." : (fetchedPool[4] ? "Pool Complete!" : "Contribute")}
                </button>
                {contributeError && (
                  <div className="text-red-500 text-sm text-center">{contributeError}</div>
                )}
                <div className="text-sm text-center text-gray-500">
                  {fetchedPool[4] 
                    ? "This pool has reached its target!"
                    : `${formatStrkAmount(fetchedPool[3])} / ${fetchedPool[1]} STRK raised`
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      <section className="container mx-auto px-4 py-16 text-center relative z-10">
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-3xl p-12 text-white glass-effect shadow-2xl animate-gradient-x stagger-animation">
          <h2 className="text-4xl font-bold mb-4">Ready to Start Saving with Friends? 🎉</h2>
          <p className="text-xl mb-8 opacity-90">Join thousands of groups achieving their goals together! 💫</p>
          <CreateGoalDialog />
        </div>
      </section>
    </div>
  );
};

export default Home;