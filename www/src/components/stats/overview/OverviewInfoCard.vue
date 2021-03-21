<template>
  <div class="overview-info-card">
    <div class="overview-info-card__group">
      <h2>{{ name }}</h2>
      <div v-if="icon">
        <img :src="icon" :alt="`${name} server icon`" />
      </div>
      <div v-else class="overview-info-card__placeholder">
        <div>?</div>
      </div>
    </div>
    <div class="overview-info-card__group">
      <h2>ID</h2>
      <h3>{{ id }}</h3>
    </div>
    <div class="overview-info-card__group">
      <h2>Members</h2>
      <h3>{{ memberCount }}</h3>
    </div>
    <div class="overview-info-card__group">
      <h2>Pickup players</h2>
      <h3>{{ pickupPlayerCount }}</h3>
    </div>
    <div class="overview-info-card__group">
      <h2>Pickups played</h2>
      <h3>{{ playedPickupsCount }}</h3>
    </div>
    <div class="overview-info-card__group">
      <h2>Lastgame</h2>
      <h3>{{ localDate }}</h3>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    name: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: false,
      default: null,
    },
    id: {
      type: String,
      required: true,
    },
    memberCount: {
      type: Number,
      required: true,
    },
    pickupPlayerCount: {
      type: Number,
      required: true,
    },
    playedPickupsCount: {
      type: Number,
      required: true,
    },
    lastGame: {
      type: Object as () => { name: string; date: Date },
      required: true,
    },
  },
  setup(props) {
    const localDate = new Date(props.lastGame.date).toLocaleDateString(
      undefined,
      {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
    return {
      localDate,
    };
  },
});
</script>

<style lang="scss" scoped>
.overview-info-card {
  color: $white;
  width: 25rem;

  & > :not(:last-child):not(:first-child) {
    border-bottom: 1px solid rgba($white, 0.05);
  }

  & > :not(:first-child) {
    padding-top: 2rem;
  }

  & :first-child {
    h2 {
      margin-bottom: 2rem;
    }
  }

  &__group:first-of-type {
    h2 {
      color: $white;
    }
  }

  &__group {
    display: flex;
    flex-flow: column;
    align-content: center;
    justify-content: center;
    font-family: "Roboto", sans-serif;
    padding-bottom: 2rem;

    img {
      border-radius: 50%;
      width: 12rem;
      height: 12rem;
      display: block;
      margin: 0 auto;
      box-shadow: 0px 10px 10px 3px $dark-2;
    }

    & h2 {
      margin-bottom: 0.5rem;
      font-weight: 400;
      font-size: 2rem;
      color: $light-gray;
    }

    & h3 {
      font-size: 1.5rem;
      font-weight: 400;
    }

    & h2,
    & h3 {
      text-align: center;
    }
  }

  &__placeholder {
    align-self: center;
    position: relative;
    width: 12rem;
    height: 12rem;
    border-radius: 50%;
    background-color: $dark;
    margin-right: 1rem;
    box-shadow: 0px 10px 10px 3px $dark-2;

    div {
      position: absolute;
      top: 50%;
      left: 50%;
      font-size: 10rem;
      transform: translate(-50%, -50%);
    }
  }
}
</style>
