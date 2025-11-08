import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserLanguage = () => {
  const [language, setLanguage] = useState<string>("en-US");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setIsLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', session.user.id)
          .single();

        if (profile?.preferred_language) {
          setLanguage(profile.preferred_language);
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  return { language, isLoading };
};
