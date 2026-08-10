import { FileText, Database, Cpu, Coins } from "lucide-react";
import { motion } from "framer-motion";

interface StatsData {
  totalDocuments: number;
  totalTokens: number;
  totalChunks: number;
  totalEmbeddings: number;
}

interface StatsCardsProps {
  stats: StatsData;
}

const statConfig = [
  { key: "totalDocuments" as const, label: "Total Documents", icon: FileText, gradient: "from-navy-deep via-navy to-navy-light", iconBg: "bg-navy/10", iconColor: "text-navy" },
  { key: "totalTokens" as const, label: "Total Tokens", icon: Coins, gradient: "from-mint-glow via-mint to-mint-light", iconBg: "bg-mint/10", iconColor: "text-mint-glow" },
  { key: "totalChunks" as const, label: "Total Chunks", icon: Cpu, gradient: "from-navy-light via-navy to-navy-deep", iconBg: "bg-navy/10", iconColor: "text-navy" },
  { key: "totalEmbeddings" as const, label: "Total Embeddings", icon: Database, gradient: "from-mint via-mint-glow to-mint", iconBg: "bg-mint/10", iconColor: "text-mint-glow" },
];

const StatsCards = ({ stats }: StatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statConfig.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5, type: "spring", stiffness: 100 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group relative overflow-hidden rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-500 cursor-default"
          >
            {/* Background shimmer on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer" />

            {/* Gradient accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <motion.p
                  key={stats[stat.key]}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-3xl font-display font-bold text-foreground tabular-nums"
                >
                  {stats[stat.key].toLocaleString()}
                </motion.p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                <Icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>

            {/* Bottom glow line */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${stat.gradient} scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
          </motion.div>
        );
      })}
    </div>
  );
};

export default StatsCards;
