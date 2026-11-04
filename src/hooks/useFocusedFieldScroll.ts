import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, TextInput, View } from "react-native";

// Marge laissée au-dessus du champ qui reçoit le focus
export const FOCUS_MARGIN = 120;

// Fiche longue sur Android : la feuille ne se redimensionne pas avec le clavier. Le contenu reçoit
// une marge de la hauteur du clavier et le champ qui a le focus défile au-dessus.
export function useFocusedFieldScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollToFocused = () => {
    const input = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    if (!input || !content) return;
    input.measureLayout(
      content,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - FOCUS_MARGIN), animated: true }),
      () => {}
    );
  };

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      requestAnimationFrame(scrollToFocused);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Autre champ touché alors que le clavier est déjà ouvert
  const onTouchEnd = () => {
    if (keyboardHeight > 0) requestAnimationFrame(scrollToFocused);
  };

  return { scrollRef, contentRef, keyboardHeight, onTouchEnd };
}
