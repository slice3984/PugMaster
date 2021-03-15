<template>
  <div class="guild-info-card" :class="style" @click="handleCardClick($event)">
    <div class="guild-info-card__icon" v-if="iconUrl">
      <img :src="iconUrl" :alt="`${name} server icon`" />
    </div>
    <div class="guild-info-card__placeholder" v-else>
      <div>?</div>
    </div>
    <div class="guild-info-card__info">
      <h2>{{ name }}</h2>
      <h3>{{ id }}</h3>
    </div>
    <div class="guild-info-card__bookmark-icon">
      <base-icon
        height="2rem"
        width="2rem"
        icon="star"
        :class="
          isBookmarked
            ? 'guild-info-card__bookmark-icon--active'
            : 'guild-info-card__bookmark-icon--disabled'
        "
      ></base-icon>
    </div>
  </div>
</template>

<script lang="ts">
import { useRouter } from "vue-router";
import { computed, defineComponent, ref } from "vue";

export default defineComponent({
  props: {
    id: String,
    name: String,
    iconUrl: String,
    isBookmarked: Boolean,
    isBookmark: Boolean,
  },
  emits: ["toggle-bookmark"],
  setup(props, ctx) {
    const router = useRouter();
    const guildUrl = `/stats/${props.id}`;

    const handleCardClick = (event) => {
      if (event.target.tagName === "use") {
        ctx.emit("toggle-bookmark", {
          id: props.id,
          name: props.name,
          icon: props.iconUrl,
        });
      } else {
        router.push(guildUrl);
      }
    };

    const style = computed(() =>
      props.isBookmark ? "guild-info-card--bookmark" : "guild-info-card--search"
    );

    return {
      style,
      handleCardClick,
    };
  },
});
</script>

<style lang="scss" scoped>
.guild-info-card {
  position: relative;
  padding: 0.5rem 3rem 0.5rem 1rem;
  border-radius: 3px;
  display: flex;
  align-items: center;
  cursor: pointer;

  &__placeholder {
    position: relative;
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    background-color: $dark;
    margin-right: 1rem;

    div {
      position: absolute;
      top: 50%;
      left: 50%;
      font-size: 4rem;
      transform: translate(-50%, -50%);
    }
  }

  &__icon {
    margin-right: 1rem;

    img {
      border-radius: 50%;
      width: 5rem;
      height: 5rem;
    }
  }

  &__info {
    h2 {
      font-size: 2rem;
    }

    h3 {
      font-weight: 400;
    }
  }

  &__bookmark-icon {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    cursor: pointer;

    &--active {
      fill: $gold;

      &:hover {
        fill: $light-gray;
      }
    }

    &--disabled {
      fill: $light-gray;

      &:hover {
        fill: $gold;
      }
    }
  }

  &--search {
    background-color: $gray;
    color: $white;

    &:hover {
      background-color: darken($gray, 10);
    }
  }

  &--bookmark {
    background-color: $dark-green;
    color: $white;

    &:hover {
      background-color: lighten($dark-green, 10);
    }
  }
}
</style>