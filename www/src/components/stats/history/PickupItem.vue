<template>
  <div class="pickup-item">
    <base-toast-message
      :type="toastType"
      :show="toastDisplayed"
      relativeTo=".pickup-history"
    >
      <template #title>
        {{ toastTitle }}
      </template>
      <template #default>
        {{ toastContent }}
      </template>
    </base-toast-message>
    <header class="pickup-item__header" @click="handleExtendToggle">
      <div class="pickup-item__bar">
        <div>
          <div class="pickup-item__info" :style="{ width: `${nameWidth}rem` }">
            {{ name }}
          </div>
          <div
            class="pickup-item__info"
            :style="{ width: `${playersWidth}rem` }"
          >
            {{ players }} Players
          </div>
        </div>
        <div>{{ localDate }}</div>
        <div class="pickup-item__controls">
          <div class="pickup-item__control">
            <base-icon
              width="2rem"
              height="2rem"
              icon="share"
              fill="#fff"
              @click.stop="handleShareToggle"
            ></base-icon>
          </div>
          <div class="pickup-item__control">
            <base-icon
              v-if="showExtendedInfo"
              width="2rem"
              height="2rem"
              icon="collapse"
              fill="#aaa"
            ></base-icon>
            <base-icon
              v-else
              width="2rem"
              height="2rem"
              icon="extend"
              fill="#fff"
            ></base-icon>
          </div>
        </div>
      </div>
      <div class="pickup-item__share" v-if="isShareExtended">
        <div class="pickup-item__share-link">{{ shareLink }}</div>
        <base-button class="pickup-item__share-btn" @click.stop="handleShare"
          >Share</base-button
        >
      </div>
    </header>
    <div class="pickup-item__content" v-if="showExtendedInfo">
      <div
        class="pickup-item__team"
        v-for="team in pickupInfo.teams"
        :key="team"
      >
        <h2>
          {{ pickupInfo.teams.length > 1 ? `Team ${team.name}` : "Players" }}
          {{ team.outcome ? " - " : "" }}
          <span v-if="team.outcome" :class="outcomeCssClass(team.outcome)">
            {{ transformTeamOutcome(team) }}
          </span>
        </h2>
        <div class="pickup-item__players">
          <router-link
            :to="{ name: 'player-view', params: { playerId: player.id } }"
            class="pickup-item__player"
            v-for="player of team.players"
            :key="player.id"
          >
            <div>
              {{ player.nick }}
            </div>
            <base-icon
              width="1rem"
              height="1rem"
              icon="link"
              fill="#fff"
            ></base-icon>
          </router-link>
        </div>
      </div>
      <div class="pickup-item__data">
        <div>
          Rated:
          <span :class="ratedCssClass(pickupInfo)">{{
            pickupInfo.isRated ? "Yes" : "No"
          }}</span>
        </div>
        <div>
          Map:
          <span>{{ pickupInfo.map ? pickupInfo.map : "-" }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PickupInfo } from "@/store/types";
import { computed, defineComponent, onMounted, onUpdated, ref } from "vue";
import { useToast } from "@/composables/useToast";

interface PickupDetails extends Partial<PickupInfo> {
  retrieved: boolean;
}

export default defineComponent({
  props: {
    id: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    nameWidth: {
      type: Number,
      required: true,
    },
    players: {
      type: Number,
      required: true,
    },
    playersWidth: {
      type: Number,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    shouldExtend: {
      type: Boolean,
      required: true,
    },
    pickupInfo: {
      type: Object as () => PickupDetails,
      required: true,
    },
  },
  emits: ["pickup-info"],
  setup(props, ctx) {
    const isShareExtended = ref(false);
    const isExtended = ref(false);
    const shareLink = `${window.location.href.substring(
      0,
      window.location.href.indexOf("?")
    )}/${props.id}`;

    const {
      toastType,
      toastTitle,
      toastContent,
      toastDisplayed,
      createToast,
    } = useToast();

    const localDate = new Date(props.date).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (props.shouldExtend) {
      ctx.emit("pickup-info", { pickupId: props.id });
      isExtended.value = true;
    }

    const transformTeamOutcome = (team) => {
      if (team.outcome) {
        switch (team.outcome) {
          case "win":
            return "Won";
          case "draw":
            return "Drew";
          case "loss":
            return "Lost";
        }
      }
      return "";
    };

    const outcomeCssClass = (outcome) => {
      return {
        "pickup-item__green": outcome === "win",
        "pickup-item__red": outcome === "loss",
        "pickup-item__gray": outcome === "draw",
      };
    };

    const ratedCssClass = (pickup) => {
      return {
        "pickup-item__green": pickup.isRated,
        "pickup-item__red": !pickup.isRated,
      };
    };

    const showExtendedInfo = computed(
      () => isExtended.value && props.pickupInfo.retrieved
    );

    const handleExtendToggle = () => {
      if (isExtended.value) {
        isExtended.value = false;
      } else {
        if (props.pickupInfo.retrieved) {
          isExtended.value = true;
        } else {
          ctx.emit("pickup-info", { pickupId: props.id });
          isExtended.value = true;
        }
      }
    };

    const handleShareToggle = () => {
      isShareExtended.value = !isShareExtended.value;
    };

    const handleShare = async () => {
      await navigator.clipboard.writeText(shareLink);
      createToast("success", "Copied", "Pickup url copied to clipboard", 3000);
    };

    return {
      toastType,
      toastTitle,
      toastContent,
      toastDisplayed,
      localDate,
      handleExtendToggle,
      showExtendedInfo,
      handleShareToggle,
      isShareExtended,
      shareLink,
      handleShare,
      transformTeamOutcome,
      outcomeCssClass,
      ratedCssClass,
    };
  },
});
</script>

<style lang="scss" scoped>
.pickup-item {
  width: 100%;
  font-size: 1.5rem;

  &__header {
    display: flex;
    flex-flow: column;
    padding: 0.5rem 1rem;
    background-color: $dark;
    cursor: pointer;

    &:hover {
      background-color: darken($dark, 2);
    }
  }

  &__bar {
    display: flex;
    justify-content: space-between;
    align-items: center;

    & > div {
      display: flex;
    }
  }

  &__info {
    font-size: 1.5rem;
    padding: 0.5rem 0.5rem;
    box-sizing: content-box;
    background-color: darken($dark, 4);
    text-align: center;

    &:not(:last-child) {
      margin-right: 1rem;
    }
  }

  &__controls {
    display: flex;
    & svg {
      cursor: pointer;

      &:hover {
        fill: $white;
      }
    }
    & div:first-child {
      margin-right: 1rem;
    }
  }

  &__share {
    display: flex;
    align-items: center;
    padding: 0.5rem 0;

    &-link {
      width: 100%;
      padding: 0.5rem 1rem;
      margin-right: 1rem;
      border-radius: 3rem;
      user-select: all;
      background-color: #393b44;
    }

    &-btn {
      margin: 0;
      background-color: $green;

      &:hover {
        background-color: $dark-green;
      }
    }
  }

  &__content {
    padding: 0.5rem 1rem;
    background-color: darken($dark, 3);
  }

  &__team {
    &:not(:last-child) {
      margin-bottom: 1rem;
    }
    h2 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
  }

  &__red {
    color: $red;
  }

  &__green {
    color: $green;
  }

  &__gray {
    color: $gray;
  }

  &__player {
    position: relative;
    display: inline-flex;
    padding: 0.5rem 2rem;
    margin-bottom: 1rem;
    color: $white;
    background-color: $dark;
    cursor: pointer;

    &:hover {
      background-color: $blue;
    }

    &:not(:last-child) {
      margin-right: 1rem;
    }

    & svg {
      position: absolute;
      top: 0;
      right: 0;
    }
  }

  &__data {
    & span {
      font-weight: 600;
    }
  }
}

a {
  text-decoration: none;
}
</style>
