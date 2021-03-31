<template>
  <div class="player-search">
    <div>
      <div class="player-search__heading">
        <h2>Search for the player you want to retrieve stats for</h2>
      </div>
      <div class="player-search__input">
        <input
          type="text"
          id="player-search"
          placeholder="Nick or full id.."
          v-model="searchInput"
        />
        <div class="player-search__results" v-if="activeSearch">
          <router-link
            v-for="result in results"
            :key="result.id"
            :to="{ name: 'player-view', params: { playerId: result.id } }"
            class="player-search__result"
          >
            <h2>{{ result.nick }}</h2>
            <h2 v-if="result.knownAs">Played as: {{ result.knownAs }}</h2>
            <h3>ID: {{ result.id }}</h3>
          </router-link>
          <div class="player-search__results-left" v-if="resultsLeft">
            <h2>One or more results left</h2>
            <h3>Try to be more specific</h3>
          </div>
          <div class="player-search__no-results" v-if="noResults">
            <h2>No matches</h2>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { rootKey } from "@/store/types";
import { useStore } from "vuex";
import { defineComponent, ref, watch } from "vue";
import { debounce } from "@/util";
import postApi from "@/store/postApi";

export default defineComponent({
  props: {
    guildId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const searchInput = ref();
    const results = ref([]);
    const resultsLeft = ref(false);
    const noResults = ref(false);
    const activeSearch = ref(false);

    const store = useStore(rootKey);

    const basicGuildInfo = store.getters["stats/getBasicGuildInfo"](
      props.guildId
    );

    if (!basicGuildInfo) {
      store.dispatch("stats/fetchBasicGuildInfo", props.guildId);
    }

    watch(
      searchInput,
      debounce(async (newValue, oldValue) => {
        if (!newValue.length) {
          results.value = [];
          noResults.value = false;
          resultsLeft.value = false;
          activeSearch.value = false;
          return;
        }

        activeSearch.value = true;

        const response = await postApi("player-search", {
          id: props.guildId,
          search: searchInput.value,
        });

        if (response && response.status === "success" && response.sent) {
          noResults.value = false;
          resultsLeft.value = response.matchesLeft;
          results.value = response.matches.map((r) => ({
            nick: r.currentNick,
            knownAs: r.knownAs,
            id: r.id.toString(),
          }));
        } else {
          resultsLeft.value = false;
          noResults.value = true;
          results.value = [];
        }
      }, 500)
    );

    return {
      searchInput,
      activeSearch,
      noResults,
      resultsLeft,
      results,
    };
  },
});
</script>

<style lang="scss" scoped>
.player-search {
  margin-top: 5rem;
  position: relative;
  display: flex;
  flex-flow: column;
  align-items: center;

  h2 {
    font-size: 2rem;
    font-weight: 400;
    margin-bottom: 1rem;
  }

  &__results {
    border: 1px solid $blue;
    border-top: none;
  }

  &__result {
    font-size: 1rem;
    display: block;
    text-decoration: none;
    color: $white;
    padding: 1rem 1rem;
    background-color: lighten($dark, 10);

    h2 {
      white-space: nowrap;
      font-size: 1.5rem;
    }

    &:hover {
      background-color: $blue-2;
    }

    &:not(:first-child) {
      padding: 1rem 1rem;
    }

    &:not(:last-child) {
      border-bottom: 1px solid $dark;
    }
  }

  &__results-left,
  &__no-results {
    background-color: $blue-2;
    padding: 1rem 0;
    text-align: center;

    h2 {
      font-size: 1.5rem;
      margin-bottom: 0;
    }
  }

  &__results-left {
    background-color: $blue-2;
    padding: 1rem 0;
    text-align: center;

    h3 {
      font-size: 1.25rem;
    }
  }

  input {
    width: 100%;
    padding: 0.5rem 1rem;
    font-size: 2rem;
    border-radius: 1px;
    border: 1px solid $blue;
    color: $white;
    background-color: $dark;

    &:focus {
      outline: none;
    }
  }
}
</style>