<template>
  <div class="pickup-history">
    <div class="content">
      <div class="content__sorting">
        <div>
          <base-button
            class="btn"
            :active="sortBy === 'date'"
            @click="updateSorting('date')"
            >Date</base-button
          >
        </div>
        <div>
          <base-button
            class="btn"
            :active="sortBy === 'gt'"
            @click="updateSorting('gt')"
            >Gametype</base-button
          >
        </div>
        <div>
          <base-button
            class="btn"
            :active="sortBy === 'count'"
            @click="updateSorting('count')"
            >Player count</base-button
          >
          <base-icon
            v-if="orderDesc === '1'"
            width="2rem"
            height="2rem"
            fill="#fff"
            icon="desc"
            @click="updateOrder"
          />
          <base-icon
            v-else
            width="2rem"
            height="2rem"
            fill="#fff"
            icon="asc"
            @click="updateOrder"
          />
        </div>
      </div>
      <div class="content__items">
        <ul>
          <li v-for="pickup in listedPickups" :key="pickup.id">
            <pickup-item
              :id="pickup.id"
              :name="pickup.name"
              :name-width="pickup.nameWidth"
              :players="pickup.players"
              :players-width="pickup.playersWidth"
              :date="pickup.date"
              :shouldExtend="pickup.shouldExtend"
              :pickup-info="pickup.pickupInfo"
              @pickup-info="getPickupInfo"
            ></pickup-item>
          </li>
        </ul>
      </div>
      <div class="content__nav" v-if="navPages.length">
        <base-icon
          v-if="gotPreviousPages"
          width="2.5rem"
          height="2.5rem"
          fill="#fff"
          icon="previous"
          @click="switchPage(pageNum - 1)"
        />
        <base-button
          v-for="page in navPages"
          :key="page"
          :active="pageNum == page"
          class="nav-btn"
          @click="switchPage(page)"
          >{{ page }}</base-button
        >
        <base-icon
          v-if="gotLeftPages"
          width="2.5rem"
          height="2.5rem"
          fill="#fff"
          icon="next"
          @click="switchPage(pageNum + 1)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { rootKey } from "@/store/types";
import { useStore } from "vuex";
import { defineComponent, ref } from "vue";
import PickupItem from "@/components/stats/history/PickupItem.vue";
import postApi from "@/store/postApi";
import { useRoute, useRouter } from "vue-router";

export default defineComponent({
  props: {
    guildId: {
      type: String,
      required: true,
    },
  },
  components: { PickupItem },
  setup(props) {
    const RESULTS_PER_PAGE = 10;
    let amountPickups = null;
    let sortBy = ref("date");
    let orderDesc = ref("1");
    const pageNum = ref(1);
    const navPages = ref([]);
    const gotPreviousPages = ref(true);
    const gotLeftPages = ref(true);

    const router = useRouter();
    const route = useRoute();

    const store = useStore(rootKey);
    const listedPickups = ref([]);

    const loadPage = async (pageNum, extendPickup = null) => {
      const retrievedPickups = await postApi("pickups", {
        id: props.guildId,
        by: sortBy.value,
        page: pageNum,
        desc: orderDesc.value,
      });

      const nameWidth =
        // @ts-ignore
        Math.max(...retrievedPickups.map((p) => p.name.length)) + 1;
      const playersWidth =
        Math.max(
          ...retrievedPickups.map((p) => `${p.players} Players`.length)
        ) + 1;

      listedPickups.value.splice(0);
      retrievedPickups.forEach(async (pickup) => {
        // Check for already stored extended info
        const pickupInfo = store.getters["pickups/getPickupInfo"](
          props.guildId,
          pickup.id
        );

        listedPickups.value.push({
          id: pickup.id,
          name: pickup.name,
          nameWidth,
          players: pickup.players,
          playersWidth,
          date: pickup.date,
          shouldExtend: pickup.id == extendPickup,
          pickupInfo: pickupInfo
            ? { ...pickupInfo, retrieved: true }
            : { retrieved: false },
        });
      });

      updateNav();
    };

    const updateSorting = (by) => {
      if (sortBy.value === by) {
        return;
      }

      sortBy.value = by;
      switchPage(pageNum.value, true);
    };

    const updateOrder = () => {
      orderDesc.value = orderDesc.value === "1" ? "0" : "1";
      switchPage(pageNum.value, true);
    };

    const switchPage = (page, force = false) => {
      if (!force && page === pageNum.value) {
        return;
      }

      router.replace({
        name: "pickups",
        query: { page, by: sortBy.value, desc: orderDesc.value },
      });

      pageNum.value = page;
      loadPage(page);
    };

    const updateNav = () => {
      navPages.value.splice(0);

      let previousPages = pageNum.value - 1;
      let leftPages = Math.ceil(
        (amountPickups - pageNum.value * RESULTS_PER_PAGE) / RESULTS_PER_PAGE
      );

      if (previousPages) {
        navPages.value.push(1);

        for (let i = pageNum.value - 3; i < pageNum.value; i++) {
          if (i < 2) {
            continue;
          }

          navPages.value.push(i);
        }
        gotPreviousPages.value = true;
      } else {
        gotPreviousPages.value = false;
      }

      navPages.value.push(pageNum.value);

      if (leftPages) {
        for (let i = pageNum.value; i < pageNum.value + leftPages; i++) {
          if (i > pageNum.value + leftPages || i - pageNum.value === 4) {
            return;
          }

          navPages.value.push(i + 1);
        }
      } else {
        gotLeftPages.value = false;
      }
    };

    // Init
    (async () => {
      amountPickups = await (
        await postApi("pickup-count", { id: props.guildId })
      ).amount;

      const pickupId = route.params.pickupId;
      let validPickupId = false;

      if (pickupId) {
        const rowNum = await (
          await postApi("/pickup-row-num", {
            id: props.guildId,
            pickup: pickupId,
          })
        ).row;

        if (rowNum) {
          const page = Math.ceil(rowNum / RESULTS_PER_PAGE);
          pageNum.value = page;
          validPickupId = true;
        }
      }

      if (
        route.query.page &&
        +route.query.page < amountPickups * RESULTS_PER_PAGE
      ) {
        pageNum.value = +route.query.page;
      }

      if (
        route.query.by &&
        ["date", "gt", "count"].includes(route.query.by.toString())
      ) {
        sortBy.value = route.query.by.toString();
      }

      if (
        route.query.desc &&
        ["0", "1"].includes(route.query.desc.toString())
      ) {
        orderDesc.value = route.query.desc.toString();
      }

      router.replace({
        name: "pickups",
        query: { page: pageNum.value, by: sortBy.value, desc: orderDesc.value },
      });

      loadPage(pageNum.value, validPickupId ? pickupId : null);
    })();

    const getPickupInfo = (payload) => {
      (async () => {
        await store.dispatch("pickups/fetchPickup", {
          guildId: props.guildId,
          pickupId: payload.pickupId,
        });

        const pickupInfo = store.getters["pickups/getPickupInfo"](
          props.guildId,
          payload.pickupId
        );

        let pickup = listedPickups.value.find((p) => p.id === payload.pickupId);

        pickup.pickupInfo = {
          retrieved: true,
          ...pickupInfo,
        };
      })();
    };

    const basicGuildInfo = store.getters["stats/getBasicGuildInfo"](
      props.guildId
    );

    if (!basicGuildInfo) {
      store.dispatch("stats/fetchBasicGuildInfo", props.guildId);
    }

    return {
      listedPickups,
      getPickupInfo,
      navPages,
      pageNum,
      gotPreviousPages,
      gotLeftPages,
      switchPage,
      updateSorting,
      updateOrder,
      sortBy,
      orderDesc,
    };
  },
});
</script>

<style lang="scss" scoped>
.pickup-history {
  position: relative;
}
.content {
  width: 60%;
  margin: 0 auto;
  margin-top: 3rem;

  & svg {
    cursor: pointer;

    &:hover {
      fill: $gray;
    }
  }

  &__items {
    & ul {
      list-style: none;
    }
    & ul li:not(:last-child) {
      margin-bottom: 1rem;
    }
  }

  &__nav {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 2rem;

    & svg {
      margin: 0 1rem;
      cursor: pointer;
    }
  }

  &__items {
    max-height: 75vh;
    overflow-y: auto;
  }

  &__sorting {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 1rem;

    & div {
      display: flex;
      align-items: center;

      & button {
        width: 12rem;
        margin: 0;
      }

      & svg {
        margin-left: 0.5rem;
      }

      &:not(:last-child) {
        margin-right: 1rem;
      }
    }
  }
}

.nav-btn {
  font-size: 2rem;
}

.btn {
  &.active {
    &:hover {
      background-color: $blue;
    }
  }
}
</style>
